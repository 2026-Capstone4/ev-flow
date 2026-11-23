import os
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
from app.db.models import CityCharger, CityStatusLog, LiveCharger, LiveStatusLog  # noqa: E402


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
    assert first == [("city", True, "🚨 [EV-flow] 마포 도심 이상 - 3회 연속 수집 실패")]
    # 같은 문제가 이어지면 다시 보내지 않음
    assert alerts.plan_messages(problem, {"city"}) == []
    assert alerts.plan_messages({}, {"city"}) == [("city", False, "✅ [EV-flow] 마포 도심 복구")]


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
    assert alert_env.sent == ["🚨 [EV-flow] 마포 도심 이상 - 3회 연속 수집 실패"] * 2
    set_runs(alert_env, HEALTHY_RECENT, HEALTHY_OK)
    alerts.check_collection_health()
    alerts.check_collection_health()
    assert alert_env.sent[2:] == ["✅ [EV-flow] 마포 도심 복구"]


def test_check_db_error_alerts_once_and_keeps_region_alerts(alert_env):
    set_runs(alert_env, {**HEALTHY_RECENT, "city": ["FAILED"] * 3}, HEALTHY_OK)
    alerts.check_collection_health()

    def broken(db):
        raise RuntimeError("db down")

    alert_env.monkeypatch.setattr(alerts, "load_runs", broken)
    alerts.check_collection_health()
    alerts.check_collection_health()
    # DB 오류는 한 번만, 마포 도심 알림은 복구로 착각하지 않음
    assert alert_env.sent[1:] == [
        "🚨 [EV-flow] 수집 상태 확인 이상 - 수집 기록을 읽지 못함 (DB 오류)"
    ]
    set_runs(alert_env, HEALTHY_RECENT, HEALTHY_OK)
    alerts.check_collection_health()
    assert sorted(alert_env.sent[2:]) == [
        "✅ [EV-flow] 마포 도심 복구",
        "✅ [EV-flow] 수집 상태 확인 복구",
    ]


def test_check_does_nothing_without_webhook(monkeypatch):
    monkeypatch.setattr(alerts.settings, "discord_webhook_url", SecretStr(""))

    def fail(*args, **kwargs):
        raise AssertionError("부르면 안 됨")

    monkeypatch.setattr(alerts, "SessionLocal", fail)
    monkeypatch.setattr(alerts.httpx, "post", fail)
    alerts.check_collection_health()
