import os
import time
from datetime import UTC, datetime, timedelta

import pytest

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from app.api.errors import ApiError  # noqa: E402
from app.schemas.common import Charger  # noqa: E402
from app.schemas.recommendation import RecommendationFilters, RecommendationRequest  # noqa: E402
from app.schemas.station import Prediction, Station  # noqa: E402
from app.services import recommendations as rec  # noqa: E402
from app.services.directions import DirectionsUnavailable, Route  # noqa: E402

NOW = datetime(2026, 11, 21, 3, 0, tzinfo=UTC)
ORIGIN = (37.5563, 126.9220)  # 홍대입구 근처 - 마포구 안
ALL = RecommendationFilters()
VERSION = "evflow_station_recommendation_1530_20261116"


def charger(status="available", connectors=("dc_combo",), kw=100, cid="01"):
    return Charger(charger_id=cid, status=status, connector_types=list(connectors), capacity_kw=kw)


def station(sid, lat=37.5563, lng=126.9220, chargers=None, congestion="low", preds=None):
    chargers = chargers or [charger()]
    return Station(
        station_id=sid,
        name=sid,
        address="마포",
        lat=lat,
        lng=lng,
        operator="op",
        total_chargers=len(chargers),
        available_chargers=sum(c.status == "available" for c in chargers),
        slow_charger_count=0,
        mid_charger_count=0,
        congestion=congestion,
        data_quality="normal",
        prediction_available=True,
        chargers=chargers,
        predictions=preds or [],
    )


def pred(h, congestion, source="model"):
    return Prediction(
        horizon_minutes=h,
        congestion=congestion,
        wait_time_p50_minutes=None,
        wait_time_p90_minutes=None,
        source=source,
        model_version=VERSION if source == "model" else None,
    )


def travel(minutes, source="directions"):
    return rec.Travel(minutes, max(1, round(minutes)), round(minutes * 400), source)


def model(cells):
    """pred:v2 형태 - base_time은 NOW 2분 전 회차"""
    return {
        "base_time": (NOW - timedelta(minutes=2)).isoformat(),
        "model_version": VERSION,
        "stations": cells,
    }


def cell(h, congestion, occupancy):
    return {
        "horizon": h,
        "congestion": congestion,
        "wait_p50": 5.0,
        "wait_p90": 5.0,
        "occupancy": occupancy,
        "congestion_prob": 0.1,
    }


# --- 서비스 범위 · 후보 ---


def test_in_mapo():
    assert rec.in_mapo(*ORIGIN)
    assert rec.in_mapo(37.5779, 126.8916)  # 상암
    assert not rec.in_mapo(37.4979, 127.0276)  # 강남역


def test_out_of_service_area_before_db():
    body = RecommendationRequest(lat=37.4979, lng=127.0276)
    with pytest.raises(ApiError) as e:
        rec.get_recommendations(None, body)  # DB를 쓰기 전에 거절
    assert e.value.status_code == 422 and e.value.code == "OUT_OF_SERVICE_AREA"


def test_charger_filters_need_one_charger_matching_all():
    # 필터 판정 규칙 예시: DC콤보 50kW 사용 가능 + 200kW 충전 중 → 100kW · 사용 가능만이면 제외
    s = station("A", chargers=[charger(kw=50), charger("charging", kw=200, cid="02")])
    strict = RecommendationFilters(
        connector_types=["dc_combo"], min_capacity_kw=100, status_filter="available_only"
    )
    assert not rec.matches_chargers(s, strict)
    assert rec.matches_chargers(s, RecommendationFilters(min_capacity_kw=100))
    assert not rec.matches_chargers(s, RecommendationFilters(connector_types=["dc_chademo"]))


def test_nearest_candidates_skip_unavailable_far_and_keep_20():
    near = [station(f"S{i:02d}", lat=ORIGIN[0] + i * 0.001) for i in range(25)]
    broken = station("BROKEN", congestion="unavailable")
    far = station("FAR", lat=37.40)  # 약 17km
    found = rec.nearest_candidates([*near, broken, far], ORIGIN, ALL)
    assert [s.station_id for s, _ in found] == [f"S{i:02d}" for i in range(20)]


# --- 채점 ---


def test_leave_now_uses_current_occupancy():
    busy_near = station(
        "NEAR", chargers=[charger("charging"), charger(cid="02")], congestion="medium"
    )
    idle_far = station("FAR", congestion="low")
    unknown = station("UNK", congestion="unknown")
    cands = [(busy_near, 0.1), (idle_far, 2.0), (unknown, 0.2)]
    times = {"NEAR": travel(3), "FAR": travel(9), "UNK": travel(4)}
    ranked = rec.score_tab(0, cands, times, ALL, None)
    # NEAR 3/30 + 0.5 = 0.6 · FAR 9/30 + 0 = 0.3 → FAR 먼저, 확인 불가는 제외
    assert [x.station.station_id for x in ranked] == ["FAR", "NEAR"]
    assert ranked[0].source is None and ranked[0].wait_p50 is None


def test_prediction_tab_uses_model_occupancy_of_tab_horizon():
    a = station("A", preds=[pred(15, "high"), pred(30, "low")])
    b = station("B", preds=[pred(15, "low"), pred(30, "medium")])
    no_model = station("C", preds=[pred(15, "low", "baseline"), pred(30, "low", "baseline")])
    m = model(
        {
            "A": [cell(15, "high", 0.9), cell(30, "low", 0.1)],
            "B": [cell(15, "low", 0.2), cell(30, "medium", 0.6)],
            "C": [cell(15, "low", 0.0), cell(30, "low", 0.0)],
        }
    )
    cands = [(a, 1.0), (b, 1.0), (no_model, 1.0)]
    times = {"A": travel(10), "B": travel(10), "C": travel(10)}
    # 15분 후 도착 탭은 이동시간과 상관없이 15분 예측을 씀
    ranked = rec.score_tab(15, cands, times, ALL, m)
    assert [(x.station.station_id, x.congestion) for x in ranked] == [
        ("B", "low"),
        ("A", "high"),
    ]
    assert ranked[0].source == "model"
    # 30분 후 도착 탭은 30분 예측
    ranked = rec.score_tab(30, cands, times, ALL, m)
    assert [(x.station.station_id, x.congestion) for x in ranked] == [
        ("A", "low"),
        ("B", "medium"),
    ]


def test_arrival_tab_excludes_travel_longer_than_tab():
    near = station("NEAR", preds=[pred(15, "low"), pred(30, "low")])
    edge = station("EDGE", preds=[pred(15, "low"), pred(30, "low")])
    far = station("FAR", preds=[pred(15, "low"), pred(30, "low")])
    m = model(
        {sid: [cell(15, "low", 0.0), cell(30, "low", 0.0)] for sid in ("NEAR", "EDGE", "FAR")}
    )
    cands = [(near, 1.0), (edge, 3.0), (far, 5.0)]
    times = {"NEAR": travel(5), "EDGE": travel(15), "FAR": travel(20)}
    # 15분 탭: 이동 15분까지는 넣고 20분은 뺌 / 30분 탭: 셋 다 들어감
    assert [x.station.station_id for x in rec.score_tab(15, cands, times, ALL, m)] == [
        "NEAR",
        "EDGE",
    ]
    assert [x.station.station_id for x in rec.score_tab(30, cands, times, ALL, m)] == [
        "NEAR",
        "EDGE",
        "FAR",
    ]


def test_prediction_tab_empty_without_model():
    a = station("A", preds=[pred(15, "low"), pred(30, "low")])
    assert rec.score_tab(30, [(a, 1.0)], {"A": travel(5)}, ALL, None) == []


def test_exclude_high_uses_tab_congestion():
    a = station("A", congestion="high")
    b = station("B", congestion="low")
    times = {"A": travel(2), "B": travel(20)}
    f = RecommendationFilters(status_filter="exclude_high")
    ranked = rec.score_tab(0, [(a, 0.1), (b, 3.0)], times, f, None)
    assert [x.station.station_id for x in ranked] == ["B"]


def test_reason_texts():
    near = rec.Scored(station("N"), travel(3), "high", None, None, None, 1.1)
    better = rec.Scored(station("B"), travel(7), "low", None, None, None, 0.3)
    same = rec.Scored(station("S"), travel(3.2), "high", None, None, None, 1.2)
    assert rec.reason(near, near) == "가장 가까운 충전소"
    assert rec.reason(better, near) == "가장 가까운 곳보다 4분 더 이동, 혼잡 → 여유"
    assert rec.reason(same, near) == "이동 시간은 비슷함"
    recs = rec.to_recommendations([better, near, same])
    assert [r.rank for r in recs] == [1, 2, 3] and recs[0].reason.endswith("혼잡 → 여유")


# --- 이동시간 ---


def test_travel_times_fall_back_to_estimate(monkeypatch):
    def fake_route(origin, sid, dest):
        if sid == "OK":
            return Route(600, 3000, [origin, dest])
        if sid == "SLOW":
            time.sleep(0.5)
            return Route(60, 100, [origin, dest])
        raise DirectionsUnavailable()

    monkeypatch.setattr(rec.directions, "get_route", fake_route)
    monkeypatch.setattr(rec, "DIRECTIONS_WAIT_SEC", 0.1)
    cands = [(station("OK"), 1.2), (station("FAIL"), 2.4), (station("SLOW"), 0.5)]
    result = rec.travel_times(ORIGIN, cands)
    assert result["OK"] == rec.Travel(10.0, 10, 3000, "directions")
    # 실패 · 시간 초과는 2분 + 60 × km / 24
    assert result["FAIL"] == rec.Travel(8.0, 8, 2400, "estimate")
    assert result["SLOW"].source == "estimate" and result["SLOW"].minutes == pytest.approx(3.25)
