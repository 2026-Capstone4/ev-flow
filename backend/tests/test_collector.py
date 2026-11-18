import os
from datetime import UTC, datetime
from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy.dialects import postgresql

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from app.collector import api_client  # noqa: E402
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
