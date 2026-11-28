import os
from collections import Counter
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy.dialects import postgresql

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from app.collector import alerts, api_client  # noqa: E402
from app.collector.scheduler import (  # noqa: E402
    JOBS,
    ORPHANED_RUN_ERROR,
    ORPHANED_RUN_HISTORY_REASON,
    PAGE_SIZE,
    RegionCollector,
    close_orphaned_runs,
    collection_targets,
    fetch_all,
)
from app.db.models import (  # noqa: E402
    CityCharger,
    CityStatusLog,
    LiveCharger,
    LiveStatusLog,
    ServiceAreaCharger,
    ServiceAreaStatusLog,
)


def charger(sid, cid, ctype):
    return SimpleNamespace(station_id=sid, charger_id=cid, charger_type=ctype)


# --- 대상 선정 (버스전용 제외, 2026-11-16) ---


def test_collection_targets_drops_bus_and_unknown_type():
    chargers = [charger("A", "01", "04"), charger("A", "02", "11"), charger("B", "01", None)]
    assert collection_targets(chargers) == {("A", "01")}


# --- 지역 · 페이지 ---


def test_fetch_all_passes_area_and_follows_pages():
    calls = []

    def fetch(**kwargs):
        calls.append(kwargs)
        return [{}] * (PAGE_SIZE if kwargs["page_no"] == 1 else 3)

    items = fetch_all(fetch, {"zcode": "11"}, period=10)
    assert len(items) == PAGE_SIZE + 3
    assert [c["page_no"] for c in calls] == [1, 2]
    assert all(c["zcode"] == "11" and c["period"] == 10 and "zscode" not in c for c in calls)


def test_jobs_seoul_uses_zcode_and_longer_info_retries():
    seoul = next(j for j in JOBS if j[1] is LiveCharger)
    assert seoul[0] == {"zcode": "11"} and seoul[2] is LiveStatusLog
    assert seoul[3] == {"info_retries": 2, "info_deadline_sec": 180}
    c = RegionCollector(*seoul[:3], **seoul[3])
    assert (c.target, c.label) == ("live", "11")
    mapo = RegionCollector({"zscode": "11440"}, CityCharger, CityStatusLog)
    assert (mapo.target, mapo.label, mapo.info_retries) == ("city", "11440", api_client.MAX_RETRIES)


def test_fetch_all_uses_given_page_size():
    calls = []

    def fetch(**kwargs):
        calls.append(kwargs)
        return [{}] * (1000 if kwargs["page_no"] < 3 else 732)

    items = fetch_all(fetch, {"kind": "C0"}, 1000, period=10)
    assert len(items) == 2732
    assert [(c["page_no"], c["num_of_rows"], c["kind"]) for c in calls] == [
        (1, 1000, "C0"),
        (2, 1000, "C0"),
        (3, 1000, "C0"),
    ]


def test_jobs_service_area_uses_kind_c0_with_small_pages():
    # 전국 휴게소 (11/23) - 9,999건 한 번에 받으면 504라 1,000건씩
    job = next(j for j in JOBS if j[1] is ServiceAreaCharger)
    assert job[0] == {"kind": "C0"} and job[2] is ServiceAreaStatusLog
    c = RegionCollector(*job[:3], **job[3])
    assert (c.target, c.label, c.page_size, c.info_retries) == ("service_area", "C0", 1000, 2)


def test_fetch_and_apply_failure_keeps_error_format():
    def get_charger_status(**_):
        raise RuntimeError("getChargerStatus 요청 실패: ReadTimeout")

    c = RegionCollector({"zcode": "11"}, LiveCharger, LiveStatusLog)
    changed, error = c.fetch_and_apply(get_charger_status, set())
    # 운영자 수집 상태 화면 · 기존 회차 기록과 같은 형식
    assert changed == 0
    assert error == "get_charger_status [11] RuntimeError: getChargerStatus 요청 실패: ReadTimeout"


# --- 재시도 횟수 · 시간 상한 (api_client) ---


@pytest.fixture
def fake_get(monkeypatch):
    def install(responses):
        calls = []

        def get(url, params, timeout):
            calls.append(timeout)
            r = responses.pop(0)
            if isinstance(r, Exception):
                raise r
            return r

        monkeypatch.setattr(api_client.httpx, "get", get)
        return calls

    return install


def ok_response():
    return httpx.Response(
        200, json={"items": {"item": [{"statId": "A"}]}}, request=httpx.Request("GET", "http://x")
    )


def test_max_retries_controls_attempts(fake_get):
    timeout = httpx.ReadTimeout("t")
    calls = fake_get([timeout, timeout, ok_response()])
    assert api_client.get_charger_info(max_retries=2) == [{"statId": "A"}]
    assert len(calls) == 3

    calls = fake_get([timeout, timeout])
    with pytest.raises(RuntimeError, match="ReadTimeout"):
        api_client.get_charger_info()  # 기본 1회 재시도 - 마포 · 천안
    assert len(calls) == 2


def test_deadline_shrinks_timeout_and_stops(fake_get, monkeypatch):
    calls = fake_get([ok_response()])
    monkeypatch.setattr(api_client.time, "monotonic", lambda: 100.0)
    api_client.get_charger_info(deadline=112.0)
    assert calls == [12.0]  # 남은 시간이 30초보다 짧으면 그만큼만 기다림

    calls = fake_get([ok_response()])
    with pytest.raises(RuntimeError, match="시간 상한 초과"):
        api_client.get_charger_info(deadline=99.0)
    assert calls == []  # 상한이 지났으면 요청하지 않음


# --- 시작 시 끝나지 않은 회차 정리 (2026-11-17) ---


class OrphanDb:
    """close_orphaned_runs용 가짜 세션 - UPDATE는 closed 행을 돌려주고, 함수 존재 여부 · revision을 흉내 냄"""

    def __init__(self, closed, has_fn=True):
        self.closed, self.has_fn = closed, has_fn
        self.calls, self.committed = [], False

    def execute(self, stmt, params=None):
        self.calls.append((stmt, params))
        sql = str(stmt)
        if "to_regprocedure" in sql:
            value = self.has_fn
        elif "invalidate_history" in sql:
            value = 7
        else:
            value = None
        return SimpleNamespace(all=lambda: self.closed, scalar=lambda: value)

    def commit(self):
        self.committed = True
        self.calls.append(("COMMIT", None))

    def invalidations(self):
        return [p for s, p in self.calls if "invalidate_history(:changed_from" in str(s)]


T0 = datetime(2026, 11, 16, 6, 56, tzinfo=UTC)
T1 = datetime(2026, 11, 16, 6, 51, tzinfo=UTC)
T2 = datetime(2026, 11, 16, 6, 40, tzinfo=UTC)


def test_close_orphaned_runs_marks_running_as_failed():
    db = OrphanDb([("service_area", T0)])
    assert close_orphaned_runs(db) == 1
    assert db.committed
    stmt, _ = db.calls[0]
    compiled = stmt.compile(dialect=postgresql.dialect())
    sql = str(compiled)
    assert sql.startswith("UPDATE collection_runs SET")
    assert "WHERE collection_runs.status = %(status_1)s" in sql
    assert "RETURNING collection_runs.target, collection_runs.started_at" in sql
    assert "finished_at" not in sql.split("RETURNING")[0]  # 끝난 시각은 모름 - 비워 둠
    params = compiled.params
    assert params["status_1"] == "RUNNING"
    assert params["status"] == "FAILED"
    assert params["matched_count"] == params["eligible_matched_count"] == 0
    assert params["error_message"] == ORPHANED_RUN_ERROR


# --- 정리한 도심 회차가 있으면 ml 체크포인트 무효화 (AI v3.1 D1, 2026-11-18) ---


def test_close_orphaned_runs_invalidates_checkpoints_for_city_runs():
    # 서울 회차(T2)가 가장 이르지만 ml_read에 없으므로 기준은 도심 회차 중 가장 이른 T1
    db = OrphanDb([("city", T0), ("live", T2), ("city", T1)])
    assert close_orphaned_runs(db) == 3
    assert db.invalidations() == [{"changed_from": T1, "reason": ORPHANED_RUN_HISTORY_REASON}]
    # 정리 UPDATE와 같은 트랜잭션 - 무효화가 커밋보다 먼저, 커밋은 한 번
    order = [str(s) for s, _ in db.calls]
    invalidate_at = next(i for i, s in enumerate(order) if "invalidate_history(:changed_from" in s)
    assert order.count("COMMIT") == 1
    assert invalidate_at < order.index("COMMIT")


def test_close_orphaned_runs_skips_invalidation_without_city_runs():
    db = OrphanDb([("service_area", T0), ("live", T1)])
    assert close_orphaned_runs(db) == 2
    assert len(db.calls) == 2  # UPDATE · COMMIT뿐 - 함수 존재 확인도 하지 않음
    assert db.committed


def test_close_orphaned_runs_skips_invalidation_when_store_missing():
    # 마이그레이션 전 · 로컬 DB - 함수가 없으면 무효로 할 체크포인트도 없음
    db = OrphanDb([("city", T0)], has_fn=False)
    assert close_orphaned_runs(db) == 1
    assert db.invalidations() == []
    assert db.committed


def test_close_orphaned_runs_does_nothing_when_no_running():
    db = OrphanDb([])
    assert close_orphaned_runs(db) == 0
    assert len(db.calls) == 2  # UPDATE · COMMIT뿐
    assert db.committed


# 운영 알림 (INF-09) ---------------------------------------------------------

ALERT_NOW = datetime(2026, 11, 23, 6, 0, tzinfo=UTC)
FRESH = ALERT_NOW - timedelta(minutes=4)
HEALTHY_RECENT = {t: ["SUCCESS", "SUCCESS", "SUCCESS"] for t in alerts.TARGET_NAMES}
HEALTHY_OK = dict.fromkeys(alerts.TARGET_NAMES, FRESH)


def test_find_problems_failed_streak_and_stale():
    recent = {**HEALTHY_RECENT, "city": ["FAILED", "FAILED", "FAILED"]}
    # 실패 2회 뒤 성공은 아직 괜찮음
    recent["service_area"] = ["FAILED", "FAILED", "SUCCESS"]
    last_ok = {**HEALTHY_OK, "city": ALERT_NOW - timedelta(minutes=16), "live": None}
    problems = alerts.find_problems(recent, last_ok, ALERT_NOW)
    assert problems == {
        "city": ["3회 연속 수집 실패", "마지막 성공 16분 전 (14:44)"],
        "live": ["성공한 수집 기록 없음"],
    }


def test_find_problems_healthy_and_just_under_threshold():
    last_ok = {**HEALTHY_OK, "city": ALERT_NOW - timedelta(minutes=14, seconds=59)}
    assert alerts.find_problems(HEALTHY_RECENT, last_ok, ALERT_NOW) == {}


def test_plan_messages_alerts_once_then_recovers_once():
    problem = {"city": ["3회 연속 수집 실패"]}
    first = alerts.plan_messages(problem, set())
    assert first == [("city", True, "🚨 [EV-flow] 마포구(예측) 이상 - 3회 연속 수집 실패")]
    # 같은 문제가 이어지면 다시 보내지 않음
    assert alerts.plan_messages(problem, {"city"}) == []
    assert alerts.plan_messages({}, {"city"}) == [("city", False, "✅ [EV-flow] 마포구(예측) 복구")]


@pytest.fixture
def alert_env(monkeypatch):
    monkeypatch.setattr(
        alerts.settings, "discord_webhook_url", SecretStr("https://example.test/hook")
    )
    monkeypatch.setattr(alerts, "_alerted", set())

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return ALERT_NOW

    monkeypatch.setattr(alerts, "datetime", Clock)
    sent = []
    responses = []

    def fake_post(url, json=None, timeout=None):
        sent.append(json["content"])
        return responses.pop(0) if responses else httpx.Response(204)

    monkeypatch.setattr(alerts.httpx, "post", fake_post)
    return SimpleNamespace(monkeypatch=monkeypatch, sent=sent, responses=responses)


def set_runs(env, recent, last_ok):
    class Db:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    env.monkeypatch.setattr(alerts, "SessionLocal", Db)
    env.monkeypatch.setattr(alerts, "load_runs", lambda db: (recent, last_ok))


def test_check_retries_after_send_failure_and_recovers(alert_env):
    set_runs(alert_env, {**HEALTHY_RECENT, "city": ["FAILED"] * 3}, HEALTHY_OK)
    alert_env.responses.append(httpx.Response(500))
    alerts.check_collection_health()
    # 보내지 못했으면 다음 검사 때 다시 보냄
    alerts.check_collection_health()
    alerts.check_collection_health()
    assert alert_env.sent == ["🚨 [EV-flow] 마포구(예측) 이상 - 3회 연속 수집 실패"] * 2
    set_runs(alert_env, HEALTHY_RECENT, HEALTHY_OK)
    alerts.check_collection_health()
    alerts.check_collection_health()
    assert alert_env.sent[2:] == ["✅ [EV-flow] 마포구(예측) 복구"]


def test_check_db_error_alerts_once_and_keeps_region_alerts(alert_env):
    set_runs(alert_env, {**HEALTHY_RECENT, "city": ["FAILED"] * 3}, HEALTHY_OK)
    alerts.check_collection_health()

    def broken(db):
        raise RuntimeError("db down")

    alert_env.monkeypatch.setattr(alerts, "load_runs", broken)
    alerts.check_collection_health()
    alerts.check_collection_health()
    # DB 오류는 한 번만, 마포구(예측) 알림은 복구로 착각하지 않음
    assert alert_env.sent[1:] == [
        "🚨 [EV-flow] 수집 상태 확인 이상 - 수집 기록을 읽지 못함 (DB 오류)"
    ]
    set_runs(alert_env, HEALTHY_RECENT, HEALTHY_OK)
    alerts.check_collection_health()
    assert sorted(alert_env.sent[2:]) == [
        "✅ [EV-flow] 마포구(예측) 복구",
        "✅ [EV-flow] 수집 상태 확인 복구",
    ]


def test_check_does_nothing_without_webhook(monkeypatch):
    monkeypatch.setattr(alerts.settings, "discord_webhook_url", SecretStr(""))

    def fail(*args, **kwargs):
        raise AssertionError("부르면 안 됨")

    monkeypatch.setattr(alerts, "SessionLocal", fail)
    monkeypatch.setattr(alerts.httpx, "post", fail)
    alerts.check_collection_health()


def test_retry_stats_count_retries_and_recoveries(fake_get):
    api_client.take_retry_stats()
    timeout = httpx.ReadTimeout("t")
    fake_get([timeout, ok_response()])
    api_client.get_charger_status(zscode="11440")
    fake_get([timeout, timeout])
    with pytest.raises(RuntimeError):
        api_client.get_charger_status(zscode="11440")
    fake_get([timeout, timeout, ok_response()])
    api_client.get_charger_info(zcode="11", max_retries=2)
    fake_get([timeout, ok_response()])
    api_client.get_charger_status(kind="C0")
    stats = api_client.take_retry_stats()
    # 다시 부른 횟수 · 다시 불러 성공한 호출 수 - 조회 지역 코드별
    assert stats == {
        ("11440", "retried"): 2,
        ("11440", "recovered"): 1,
        ("11", "retried"): 2,
        ("11", "recovered"): 1,
        # 휴게소는 지역 코드 대신 kind - collection_runs.zscode와 같은 값
        ("C0", "retried"): 1,
        ("C0", "recovered"): 1,
    }
    assert api_client.take_retry_stats() == {}  # 가져가면 0부터


def test_notify_failed_run_sends_short_reason(alert_env):
    run = SimpleNamespace(id=42, target="city", started_at=ALERT_NOW)
    alerts.notify_failed_run(
        run, "get_charger_status [11440] RuntimeError: getChargerStatus HTTP 504"
    )
    alerts.notify_failed_run(run, "x" * 500)
    assert alert_env.sent[0] == (
        "⚠️ [EV-flow] 마포구(예측) 수집 실패 (run 42, 15:00) - "
        "get_charger_status [11440] RuntimeError: getChargerStatus HTTP 504"
    )
    assert alert_env.sent[1].endswith("x" * alerts.REASON_MAX)
    assert len(alert_env.sent[1]) < 300


def test_notify_failed_run_never_raises(alert_env):
    class Broken:
        @property
        def target(self):
            raise RuntimeError("detached")

    alerts.notify_failed_run(Broken(), "x")
    assert alert_env.sent == []


def test_format_summary_lists_regions_in_order_with_retries():
    counts = {
        ("live", "11"): Counter(SUCCESS=280, PARTIAL=5, FAILED=3),
        ("city", "11440"): Counter(SUCCESS=287, FAILED=1),
    }
    retries = Counter({("11440", "retried"): 15, ("11440", "recovered"): 14, ("11", "retried"): 4})
    since = ALERT_NOW - timedelta(hours=24)
    text = alerts.format_summary(counts, retries, since, ALERT_NOW, since - timedelta(hours=1))
    assert text.splitlines() == [
        "📊 [EV-flow] 수집 하루 요약 (11/22 15:00 ~ 11/23 15:00)",
        "- 마포구(예측): 회차 288 · 성공 287 · 일부 0 · 실패 1 | 재시도 15 · 재시도로 성공 14",
        "- 서울(마포 제외): 회차 288 · 성공 280 · 일부 5 · 실패 3 | 재시도 4 · 재시도로 성공 0",
    ]
    # 요약 기간 중에 재시작했으면 재시도 수가 그 뒤 것뿐이라고 적음
    restarted = alerts.format_summary(
        counts, retries, since, ALERT_NOW, ALERT_NOW - timedelta(hours=2)
    )
    assert restarted.splitlines()[-1] == "(재시도 수는 collector 재시작 11/23 13:00 이후분)"


def test_daily_summary_puts_back_retries_when_send_fails(alert_env):
    alert_env.monkeypatch.setattr(alerts, "load_run_counts", lambda db, since: {})
    set_runs(alert_env, {}, {})
    api_client.take_retry_stats()
    api_client._count_retry("11440", "retried")
    alert_env.responses.append(httpx.Response(500))
    alerts.send_daily_summary()
    # 못 보냈으면 재시도 수를 되돌려 다음 요약에 합침
    assert api_client.take_retry_stats() == {("11440", "retried"): 1}
    assert "끝난 회차 없음" in alert_env.sent[0]


def test_load_run_counts_groups_finished_runs_by_region():
    since = ALERT_NOW - timedelta(hours=24)
    sql = str(alerts.run_counts_query(since).compile(dialect=postgresql.dialect()))
    # 지난 24시간 · 끝난 회차만, 지역 · 조회 지역 코드 · 상태별로 셈
    assert "collection_runs.started_at >= %(started_at_1)s" in sql
    assert "collection_runs.status != %(status_1)s" in sql
    assert "GROUP BY collection_runs.target, collection_runs.zscode, collection_runs.status" in sql

    class Db:
        def execute(self, stmt):
            return SimpleNamespace(
                all=lambda: [
                    ("city", "11440", "SUCCESS", 287),
                    ("city", "11440", "FAILED", 1),
                    ("live", "11", "PARTIAL", 5),
                ]
            )

    assert alerts.load_run_counts(Db(), since) == {
        ("city", "11440"): Counter(SUCCESS=287, FAILED=1),
        ("live", "11"): Counter(PARTIAL=5),
    }
