import os
from types import SimpleNamespace

import httpx
import pytest

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from app.collector import api_client  # noqa: E402
from app.collector.scheduler import (  # noqa: E402
    JOBS,
    PAGE_SIZE,
    RegionCollector,
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
