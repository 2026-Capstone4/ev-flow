import json
import os
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from app.services import stations  # noqa: E402
from app.services.snapshot import ChargerState  # noqa: E402

NOW = datetime(2026, 11, 16, 7, 0, tzinfo=UTC)
CITY_RUN = SimpleNamespace(id=1, started_at=NOW - timedelta(minutes=2))
LIVE_RUN = SimpleNamespace(id=2, started_at=NOW - timedelta(minutes=4))
MODEL = {
    "model_version": "v",
    "stations": {"S1": [{"horizon": 15, "congestion": "low", "wait_p50": 0.0, "wait_p90": 1.0}]},
}


def place(sid):
    return SimpleNamespace(
        station_id=sid,
        name=sid,
        addr="서울",
        lat=37.5,
        lng=126.9,
        operator="op",
        slow_charger_count=0,
        mid_charger_count=0,
    )


def state(sid, status="available"):
    return ChargerState(sid, "01", status, ["dc_combo"], 100, None)


class FakeDb:
    def __init__(self, places):
        self.places = places

    def scalars(self, _query):
        return self.places


def test_seoul_stations_ignore_model_and_baseline(monkeypatch):
    monkeypatch.setattr(stations, "load_charger_states", lambda *a, **k: {"S1": [state("S1")]})
    db = FakeDb([place("S1")])
    mapo = stations.area_stations(db, stations.MAPO, CITY_RUN, NOW, MODEL, None)
    seoul = stations.area_stations(db, stations.SEOUL, LIVE_RUN, NOW, MODEL, {"S1": ["high"] * 168})
    assert mapo[0].prediction_available and mapo[0].predictions[0].source == "model"
    # 서울은 예측 · 기준선이 있어도 쓰지 않음 - 형식만 유지하고 값은 전부 null
    assert not seoul[0].prediction_available
    assert all(p.congestion is None and p.source is None for p in seoul[0].predictions)
    # 현재 혼잡도는 지금 상태로 계산 - 사용 가능 1대뿐이라 medium (low는 사용 가능 2대 이상)
    assert seoul[0].congestion == "medium"


def stub_get_stations(monkeypatch, live_run):
    monkeypatch.setattr(stations, "datetime", SimpleNamespace(now=lambda tz: NOW))
    monkeypatch.setattr(stations, "latest_success_run", lambda db, target: CITY_RUN)
    monkeypatch.setattr(stations, "find_latest_success_run", lambda db, target: live_run)
    monkeypatch.setattr(stations, "load_model_predictions", lambda: None)
    monkeypatch.setattr(stations, "load_baseline", lambda: None)
    built = {
        "city": stations.build_station(
            stations.Station,
            stations.Charger,
            place("M1"),
            [state("M1")],
            CITY_RUN.started_at,
            NOW,
            None,
            None,
            True,
        ),
        "live": stations.build_station(
            stations.Station,
            stations.Charger,
            place("S1"),
            [state("S1")],
            LIVE_RUN.started_at,
            NOW,
            None,
            None,
            False,
        ),
    }
    monkeypatch.setattr(stations, "area_stations", lambda db, area, *a: [built[area.target]])


def test_get_stations_merges_seoul_and_uses_older_run(monkeypatch):
    stub_get_stations(monkeypatch, LIVE_RUN)
    res = stations.get_stations(None)
    assert [s.station_id for s in res.stations] == ["M1", "S1"]  # 마포 다음 서울
    assert res.updated_at == LIVE_RUN.started_at  # 두 회차 중 오래된 쪽 (C안)


def test_get_stations_without_seoul_run_returns_mapo_only(monkeypatch):
    stub_get_stations(monkeypatch, None)
    res = stations.get_stations(None)
    assert [s.station_id for s in res.stations] == ["M1"]
    assert res.updated_at == CITY_RUN.started_at


def stub_stations_cache(monkeypatch, runs, clock):
    """회차 · 시각을 바꿔 가며 get_stations_json을 부르게 함 - 만든 횟수를 돌려줌"""
    stub_get_stations(monkeypatch, LIVE_RUN)
    monkeypatch.setattr(stations, "_stations_cache", None)
    monkeypatch.setattr(stations, "latest_success_run", lambda db, target: runs["city"])
    monkeypatch.setattr(stations, "find_latest_success_run", lambda db, target: runs["live"])
    monkeypatch.setattr(stations, "time", SimpleNamespace(monotonic=lambda: clock["t"]))
    built = []
    build = stations.build_stations_response
    monkeypatch.setattr(
        stations,
        "build_stations_response",
        lambda *a: built.append(1) or build(*a),
    )
    return built


def test_stations_json_matches_response_schema(monkeypatch):
    stub_stations_cache(monkeypatch, {"city": CITY_RUN, "live": LIVE_RUN}, {"t": 0})
    body = json.loads(stations.get_stations_json(None))
    # 캐시 전 응답(FastAPI가 response_model로 직렬화)과 같은 camelCase · KST 형식
    assert body == stations.get_stations(None).model_dump(mode="json", by_alias=True)
    assert body["updatedAt"].endswith("+09:00") and "stationId" in body["stations"][0]


def test_stations_json_reuses_cache_within_same_run(monkeypatch):
    clock = {"t": 0}
    built = stub_stations_cache(monkeypatch, {"city": CITY_RUN, "live": LIVE_RUN}, clock)
    first = stations.get_stations_json(None)
    clock["t"] = stations.STATIONS_CACHE_SEC - 1
    assert stations.get_stations_json(None) is first
    assert len(built) == 1


def test_stations_json_rebuilds_on_new_run(monkeypatch):
    runs = {"city": CITY_RUN, "live": LIVE_RUN}
    built = stub_stations_cache(monkeypatch, runs, {"t": 0})
    stations.get_stations_json(None)
    # 유효 시간 안이어도 새 회차가 들어오면 바로 다시 만듦 - 마포 · 서울 어느 쪽이든
    runs["live"] = SimpleNamespace(id=3, started_at=NOW)
    stations.get_stations_json(None)
    runs["city"] = SimpleNamespace(id=4, started_at=NOW)
    stations.get_stations_json(None)
    # 서울 회차가 사라져도(장애) 다른 키
    runs["live"] = None
    stations.get_stations_json(None)
    assert len(built) == 4


def test_stations_json_rebuilds_after_ttl(monkeypatch):
    clock = {"t": 0}
    built = stub_stations_cache(monkeypatch, {"city": CITY_RUN, "live": LIVE_RUN}, clock)
    stations.get_stations_json(None)
    # 같은 회차라도 유효 시간이 지나면 다시 만듦 - dataQuality 등 시간에 따라 바뀌는 값 반영
    clock["t"] = stations.STATIONS_CACHE_SEC
    stations.get_stations_json(None)
    assert len(built) == 2


def test_charger_unstable_flag_in_response():
    unstable = ChargerState("ME19A601", "21", "unknown", ["dc_combo"], 200, None, unstable=True)
    body = stations.Charger.model_validate(unstable, from_attributes=True).model_dump(by_alias=True)
    assert body["unstable"] is True
    # 값을 안 넣은 충전기(서울 실시간 등)는 false - status는 그대로 둬서 혼잡도 계산에 영향 없음
    body = stations.Charger.model_validate(state("S1"), from_attributes=True).model_dump(
        by_alias=True
    )
    assert body["unstable"] is False
