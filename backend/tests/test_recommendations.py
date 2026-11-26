import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from app.api.errors import ApiError  # noqa: E402
from app.schemas.common import Charger  # noqa: E402
from app.schemas.recommendation import RecommendationFilters, RecommendationRequest  # noqa: E402
from app.schemas.station import Station  # noqa: E402
from app.services import ai_ranking  # noqa: E402
from app.services import recommendations as rec  # noqa: E402
from app.services.snapshot import ChargerState  # noqa: E402

NOW = datetime(2026, 11, 21, 3, 0, tzinfo=UTC)
ORIGIN = (37.5563, 126.9220)  # 홍대입구 근처 - 마포구 안
ALL = RecommendationFilters()
# 로컬 AI 패키지 (저장소 밖 · gitignore) - 없으면(CI) 실제 채점 테스트는 건너뜀
PACKAGE = Path(__file__).resolve().parents[2] / "ml" / "package"


def charger(status="available", connectors=("dc_combo",), kw=100, cid="01"):
    return Charger(charger_id=cid, status=status, connector_types=list(connectors), capacity_kw=kw)


def station(sid, lat=37.5563, lng=126.9220, chargers=None, congestion="low"):
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
        predictions=[],
    )


def state(sid, cid="01", stat="2", connectors=("dc_combo",), kw=100, observed=None):
    status = {"2": "available", "3": "charging"}.get(stat, "unknown")
    return ChargerState(
        sid,
        cid,
        status,
        list(connectors),
        kw,
        None,
        stat=stat,
        observed_at=observed or NOW - timedelta(minutes=3),
    )


def travel(minutes, source="directions", fetched=None):
    return rec.Travel(minutes, max(1, round(minutes)), round(minutes * 400), source, fetched)


# --- 서비스 범위 · 후보 ---


def test_in_mapo():
    assert rec.in_mapo(*ORIGIN)
    assert rec.in_mapo(37.5779, 126.8916)  # 상암
    assert not rec.in_mapo(37.4979, 127.0276)  # 강남역


# --- 마포구 밖 지금 출발 (임시) ---

GANGNAM = (37.4979, 127.0276)  # 강남역 - 마포구 밖


def test_now_eligible_needs_available_and_respects_exclude_high():
    assert rec.now_eligible(station("A"), ALL)
    assert not rec.now_eligible(station("B", chargers=[charger("charging")]), ALL)
    high = station("C", congestion="high")
    assert rec.now_eligible(high, ALL)
    assert not rec.now_eligible(high, RecommendationFilters(status_filter="exclude_high"))


def test_now_score_travel_and_current_occupancy():
    # 운영 중 2대 중 1대 사용 가능 - 점유율 0.5. 점검 중(unknown 등)은 분모에서 뺌
    half = station("A", chargers=[charger(), charger("charging", cid="02")])
    assert rec.now_score(half, travel(6)) == pytest.approx(6 / 30 + 0.5)
    mixed = station("B", chargers=[charger(), charger("unknown", cid="02")])
    assert rec.now_score(mixed, travel(3)) == pytest.approx(3 / 30)


def test_rank_now_orders_by_score_then_travel():
    busy_near = station(
        "NEAR", chargers=[charger(), *[charger("charging", cid=f"0{i}") for i in range(2, 5)]]
    )
    free_far = station("FAR")
    tie_a, tie_b = station("TA"), station("TB")
    travel_by = {"NEAR": travel(2), "FAR": travel(12), "TA": travel(9), "TB": travel(9)}
    cands = [(s, 1.0) for s in (busy_near, free_far, tie_a, tie_b)]
    # NEAR 2/30 + 0.75 ≈ 0.82, TA · TB 9/30 = 0.3, FAR 12/30 = 0.4 → 같은 점수는 ID 순
    picked = rec.rank_now(cands, travel_by)
    assert [p.station.station_id for p in picked] == ["TA", "TB", "FAR"]
    assert all(p.basis == "recent_observation" and p.wait_p50 is None for p in picked)


def test_get_recommendations_outside_mapo_uses_now(monkeypatch):
    # 마포구 밖 - AI 채점 · 예측 없이 현재 상태만. 15 · 30분 탭은 빈 배열
    mapo_s = station("MAPO1", lat=GANGNAM[0] + 0.02, congestion="medium")
    seoul_s = station("SEOUL1", lat=GANGNAM[0] + 0.001)
    full = station("FULL", lat=GANGNAM[0], chargers=[charger("charging")])
    by_target = {"city": [mapo_s], "live": [seoul_s, full]}

    class Run:
        def __init__(self, minutes):
            self.id, self.started_at = minutes, NOW - timedelta(minutes=minutes)

    runs = {"city": Run(6), "live": Run(3)}

    class Db:
        def close(self):
            pass

    def fail_scorer():
        raise AssertionError("마포구 밖은 AI 채점을 부르지 않음")

    called = []
    monkeypatch.setattr(rec, "datetime", FrozenDatetime)
    monkeypatch.setattr(rec, "get_scorer", fail_scorer)
    monkeypatch.setattr(rec, "find_latest_success_run", lambda db, target: runs[target])
    monkeypatch.setattr(rec, "nearby_station_ids", lambda db, area, origin, f: [area.target])
    monkeypatch.setattr(
        rec,
        "load_charger_states",
        lambda db, cm, lm, run, now, station_ids: {
            s.station_id: [state(s.station_id)] for s in by_target[station_ids[0]]
        },
    )
    monkeypatch.setattr(rec, "area_stations", lambda db, area, *args: by_target[area.target])

    def fake_travel(origin, cands):
        called.extend(s.station_id for s, _ in cands)
        return {s.station_id: travel(4 if s.station_id == "SEOUL1" else 10) for s, _ in cands}

    monkeypatch.setattr(rec, "travel_times", fake_travel)
    resp = rec.get_recommendations(Db(), RecommendationRequest(lat=GANGNAM[0], lng=GANGNAM[1]))
    # 사용 가능 0대(FULL)는 길찾기 전에 빠짐 - Directions 호출을 아낌
    assert sorted(called) == ["MAPO1", "SEOUL1"]
    tabs = {r.horizon_minutes: r.recommendations for r in resp.results}
    assert [x.station.station_id for x in tabs[0]] == ["SEOUL1", "MAPO1"]
    assert tabs[15] == [] and tabs[30] == []
    first, second = tabs[0]
    assert first.basis == "recent_observation" and first.source is None
    assert first.wait_time_p50_minutes is None and first.congestion == "low"
    assert second.reason == "가장 가까운 곳보다 6분 더 걸려요"
    # 기준 시각은 쓴 회차 중 오래된 쪽
    assert resp.updated_at == runs["city"].started_at


def test_now_stations_skips_stale_area_and_needs_a_run(monkeypatch):
    class Run:
        id, started_at = 1, NOW - timedelta(minutes=16)

    runs = {"city": None, "live": Run}
    monkeypatch.setattr(rec, "find_latest_success_run", lambda db, target: runs[target])
    monkeypatch.setattr(
        rec, "nearby_station_ids", lambda *args: pytest.fail("오래된 회차는 읽지 않음")
    )
    stations, states, updated_at = rec.now_stations(None, GANGNAM, NOW, ALL)
    # 모두 오래돼 뺐으면 받은 회차 시각 그대로
    assert stations == [] and states == {} and updated_at == Run.started_at
    runs["live"] = None
    with pytest.raises(ApiError) as e:
        rec.now_stations(None, GANGNAM, NOW, ALL)
    assert e.value.status_code == 503 and e.value.code == "DATA_UNAVAILABLE"


def test_now_stations_updated_at_ignores_skipped_area(monkeypatch):
    # 마포 수집이 40분 멈추고 서울은 3분 전 - 서울로만 추천하므로 기준 시각도 서울 회차
    class Run:
        def __init__(self, minutes):
            self.id, self.started_at = minutes, NOW - timedelta(minutes=minutes)

    runs = {"city": Run(40), "live": Run(3)}
    monkeypatch.setattr(rec, "find_latest_success_run", lambda db, target: runs[target])
    monkeypatch.setattr(rec, "nearby_station_ids", lambda *args: [])
    monkeypatch.setattr(rec, "load_charger_states", lambda *args, **kwargs: {})
    monkeypatch.setattr(rec, "area_stations", lambda *args: [])
    _, _, updated_at = rec.now_stations(None, GANGNAM, NOW, ALL)
    assert updated_at == runs["live"].started_at


class FakeRows:
    """db.execute만 흉내 - nearby_station_ids가 읽는 (충전소, 좌표, 충전기 종류, 용량) 행"""

    def __init__(self, rows):
        self.rows = rows

    def execute(self, query):
        return self.rows


def pool_row(sid, lat, capacity="100", charger_type="04"):
    from types import SimpleNamespace

    return SimpleNamespace(
        station_id=sid, lat=lat, lng=GANGNAM[1], charger_type=charger_type, capacity=capacity
    )


def test_nearby_station_ids_filters_before_cutting_pool():
    # 가까운 60곳은 100kW, 그 뒤(약 7km)에 200kW 충전소 - 거리로 먼저 자르면 200kW 조건에서 빈 목록이 됐음
    rows = [pool_row(f"N{i:02d}", GANGNAM[0] + i * 0.0005) for i in range(60)]
    rows.append(pool_row("FAST", GANGNAM[0] + 0.06, "200"))
    # 200kW와 100kW가 섞인 곳 - 모든 충전기가 조건을 만족해야 하므로 200kW 조건에서 빠짐
    rows += [pool_row("MIX", GANGNAM[0] + 0.001, "200"), pool_row("MIX", GANGNAM[0] + 0.001)]
    rows.append(pool_row("FAR", GANGNAM[0] + 0.2, "200"))  # 약 22km - 반경 밖
    db = FakeRows(rows)
    fast = RecommendationFilters(min_capacity_kw=200)
    assert rec.nearby_station_ids(db, rec.MAPO, GANGNAM, fast) == ["FAST"]
    every = rec.nearby_station_ids(db, rec.MAPO, GANGNAM, ALL)
    assert len(every) == rec.NOW_POOL_LIMIT and "FAST" not in every and "MIX" in every


def test_load_charger_states_empty_ids_skips_db():
    from app.services.snapshot import load_charger_states

    assert load_charger_states(None, None, None, None, NOW, station_ids=[]) == {}


def test_charger_filters_need_every_scope_charger():
    # AI 규칙: 채점 범위 충전기가 모두 조건을 만족해야 함 (한 대만 맞으면 안 됨)
    states = [state("A", "01", kw=50), state("A", "02", "3", kw=200)]
    both = ("01", "02")
    assert rec.meets_charger_filters(both, states, ALL)
    assert not rec.meets_charger_filters(both, states, RecommendationFilters(min_capacity_kw=100))
    assert rec.meets_charger_filters(("02",), states, RecommendationFilters(min_capacity_kw=100))
    chademo = RecommendationFilters(connector_types=["dc_chademo"])
    assert not rec.meets_charger_filters(both, states, chademo)
    # 범위에 있는데 상태 행이 없는 충전기 - 메타데이터가 없어 AI도 제외함
    assert not rec.meets_charger_filters(("01", "09"), states, ALL)


def test_scope_uses_model_members_first():
    states = [state("A", "01"), state("A", "02")]
    assert rec.scope_ids("A", states, {"A": ("02",)}) == ("02",)
    assert rec.scope_ids("A", states, {}) == ("01", "02")


def test_nearest_candidates_skip_unavailable_far_and_keep_20():
    near = [station(f"S{i:02d}", lat=ORIGIN[0] + i * 0.001) for i in range(25)]
    broken = station("BROKEN", congestion="unavailable")
    far = station("FAR", lat=37.40)  # 약 17km
    stations = [*near, broken, far]
    states = {s.station_id: [state(s.station_id)] for s in stations}
    found = rec.nearest_candidates(stations, states, ORIGIN, ALL, {})
    assert [s.station_id for s, _ in found] == [f"S{i:02d}" for i in range(20)]


def test_nearest_candidates_available_only_needs_available_charger():
    busy = station("BUSY", chargers=[charger("charging")])
    free = station("FREE")
    states = {"BUSY": [state("BUSY", stat="3")], "FREE": [state("FREE")]}
    only = RecommendationFilters(status_filter="available_only")
    found = rec.nearest_candidates([busy, free], states, ORIGIN, only, {})
    assert [s.station_id for s, _ in found] == ["FREE"]


# --- AI 입력 · 결과 ---


def test_candidate_input_maps_ai_contract():
    fetched = (NOW - timedelta(minutes=7)).isoformat()
    states = [state("A", "01"), state("A", "02", "3", kw=200)]
    filters = RecommendationFilters(
        connector_types=["dc_combo"], min_capacity_kw=100, status_filter="available_only"
    )
    value = rec.candidate_input(
        "r1",
        NOW,
        station("A"),
        1.5,
        travel(6, fetched=fetched),
        filters,
        states,
        {"A": ("01", "02", "03")},
        True,
    )
    assert value["candidate_id"] == "r1:A" and value["request_at"] == NOW.isoformat()
    assert value["requested_charger_ids"] == ["01", "02", "03"]
    # 경로는 원래 조회 시각으로 넘김 - AI가 30분 넘은 경로를 거름
    assert value["route"] == {
        "travel_minutes": 6,
        "requested_at": fetched,
        "source": "directions",
        "distance_km": 6 * 400 / 1000,
    }
    assert value["requirements"] == {
        "connectors": ["dc_combo"],
        "min_output_kw": 100,
        "require_accessible": True,
        "available_now_only": True,
        "exclude_current_congested": False,
    }
    # 상태 행이 없는 03은 메타데이터 없이 관측만 "모름"으로
    assert [c["charger_id"] for c in value["chargers"]] == ["01", "02"]
    obs = value["current_evidence"]["member_observations"]
    assert [(o["charger_id"], o["stat"], o["known"]) for o in obs] == [
        ("01", "2", True),
        ("02", "3", True),
        ("03", None, False),
    ]
    assert obs[0]["observed_at"] == (NOW - timedelta(minutes=3)).isoformat()
    assert obs[2]["observed_at"] is None
    assert all(o["boundary_after_observation"] for o in obs)


def test_candidate_input_leaves_estimate_to_ai():
    value = rec.candidate_input(
        "r1", NOW, station("A"), 1.5, travel(5.75, "estimate"), ALL, [state("A")], {}, False
    )
    assert value["route"] is None and value["distance_km"] == 1.5


def test_forecast_levels_maps_labels():
    prediction = {
        "predictions": [
            {
                "station_id": "A",
                "horizon_minutes": 15,
                "components": {"congestion": {"status": "ok", "congestion_level": "혼잡"}},
            },
            {
                "station_id": "A",
                "horizon_minutes": 30,
                "components": {"congestion": {"status": "unavailable", "congestion_level": "여유"}},
            },
        ]
    }
    assert rec.forecast_levels(prediction) == {("A", 15): "high"}


def ev(sid, source, key, horizon=None, eligible=True, p50=None, p90=None):
    """AI score_tab 결과 한 행 (pick이 읽는 필드만)"""
    return {
        "station_id": sid,
        "eligible": eligible,
        "recommendation_source": source,
        "sort_key": key,
        "selected_horizon_minutes": horizon,
        "p50_minutes": p50,
        "p90_minutes": p90,
    }


def test_pick_follows_sort_key_and_projects(monkeypatch):
    monkeypatch.setattr(rec.settings, "show_wait_prediction", True)
    stations = {
        "M1": station("M1"),
        "M2": station("M2"),
        "C1": station("C1", congestion="medium"),
        "X": station("X"),
    }
    times = {sid: travel(5) for sid in stations}
    evaluation = {
        "candidate_evaluations": [
            ev("C1", "current_state", [3, -2.0, 0.5, 5.0, "C1"]),
            ev("M2", "model", [0, 0.6, 5.0, "M2"], 15, p50=1.4, p90=6.5),
            ev("X", "unavailable", None, eligible=False),
            ev("M1", "model", [0, 0.4, 5.0, "M1"], 30),
            ev("M1", "model", [0, 0.9, 5.0, "M1"], 15),  # 같은 충전소는 한 번만
        ]
    }
    levels = {("M1", 30): "low", ("M2", 15): "medium"}
    picked = rec.pick(evaluation, stations, times, levels, ALL)
    assert [(p.station.station_id, p.basis, p.congestion) for p in picked] == [
        ("M1", "forecast", "low"),
        ("M2", "forecast", "medium"),
        ("C1", "recent_observation", "medium"),
    ]
    assert (picked[1].wait_p50, picked[1].wait_p90) == (1, 7)  # 0.5는 올림
    assert picked[2].wait_p50 is None
    recs = rec.to_recommendations(picked)
    assert [(r.rank, r.source, r.basis) for r in recs] == [
        (1, "model", "forecast"),
        (2, "model", "forecast"),
        (3, None, "recent_observation"),
    ]


def test_pick_hides_wait_when_display_off(monkeypatch):
    monkeypatch.setattr(rec.settings, "show_wait_prediction", False)
    row = ev("A", "model", [0, 0.1, 1.0, "A"], 15, p50=1.0, p90=2.0)
    evaluation = {"candidate_evaluations": [row]}
    picked = rec.pick(evaluation, {"A": station("A")}, {"A": travel(1)}, {}, ALL)
    assert (picked[0].wait_p50, picked[0].wait_p90) == (None, None)


def test_pick_exclude_high_fills_next():
    evaluation = {
        "candidate_evaluations": [
            ev("H", "model", [0, 0.1, 1.0, "H"], 15),
            ev("L", "model", [0, 0.2, 1.0, "L"], 15),
        ]
    }
    stations = {"H": station("H"), "L": station("L")}
    levels = {("H", 15): "high", ("L", 15): "low"}
    f = RecommendationFilters(status_filter="exclude_high")
    picked = rec.pick(evaluation, stations, {s: travel(1) for s in stations}, levels, f)
    assert [p.station.station_id for p in picked] == ["L"]


def test_pick_without_result_is_empty():
    assert rec.pick(None, {}, {}, {}, ALL) == []


def test_reason_texts():
    near = rec.Picked(station("N"), travel(3), "forecast", "high", None, None)
    better = rec.Picked(station("B"), travel(7), "forecast", "low", None, None)
    same = rec.Picked(station("S"), travel(3.2), "forecast", "high", None, None)
    same_better = rec.Picked(station("Q"), travel(3.4), "forecast", "medium", None, None)
    unknown = rec.Picked(station("U"), travel(9), "recent_observation", None, None, None)
    assert rec.reason(near, near) == "가장 가까운 충전소예요"
    assert rec.reason(better, near) == "4분 더 걸리지만 덜 붐벼요"
    assert rec.reason(same, near) == "가장 가까운 곳과 이동 시간이 비슷해요"
    assert rec.reason(same_better, near) == "이동 시간은 비슷하고 덜 붐벼요"
    assert rec.reason(unknown, near) == "가장 가까운 곳보다 6분 더 걸려요"
    recs = rec.to_recommendations([better, near, same])
    assert [r.rank for r in recs] == [1, 2, 3] and recs[0].reason == "4분 더 걸리지만 덜 붐벼요"


def test_missing_package_is_unavailable(tmp_path):
    with pytest.raises(ai_ranking.AiPackageUnavailable):
        ai_ranking._load(tmp_path)


# --- 실제 AI 채점 (로컬 ml/package가 있을 때만) ---


@pytest.fixture
def scorer(monkeypatch):
    if not (PACKAGE / "run_recommendation.py").is_file():
        pytest.skip("로컬 AI 패키지(ml/package) 없음")
    monkeypatch.setattr(ai_ranking.settings, "ai_package_dir", str(PACKAGE))
    monkeypatch.setattr(ai_ranking, "_scorer", None)
    return ai_ranking.get_scorer()


def forecast_rows(scorer, sid, occupancy, ref, valid_minutes=20):
    """ml 응답 predictions[] 두 행(15 · 30분) - AI from_components가 읽는 필드"""
    obs, gen = NOW - timedelta(minutes=3), NOW - timedelta(minutes=2)
    rows = []
    for h in (15, 30):
        target = ref + timedelta(minutes=h)
        congestion = {
            "status": "ok",
            "fallback": False,
            "genuine_observed_at": obs.isoformat(),
            "occupancy": occupancy,
            "raw_occupancy": occupancy,
            "prediction_reference_at": ref.isoformat(),
            "target_at": target.isoformat(),
            "generated_at": gen.isoformat(),
            "valid_until": min(ref + timedelta(minutes=valid_minutes), target).isoformat(),
            "data_as_of": obs.isoformat(),
            "feature_source_max_at": obs.isoformat(),
            "model_version": scorer.support.model_version,
            "n_oper": len(scorer.station_members()[sid]),
            "native_confirmed_ratio": 1.0,
            "prediction_snapshot_id": "snap",
            "evidence_cutoff_at": obs.isoformat(),
            "congestion_level": "여유",
        }
        rows.append(
            {
                "station_id": sid,
                "charger_ids": list(scorer.station_members()[sid]),
                "horizon_minutes": h,
                "components": {"congestion": congestion, "time": None},
            }
        )
    return rows


def run_ai(scorer, rows, cases, filters=ALL):
    """cases: 충전소 → (이동 Travel, 관측 시각). 탭 이름 → 적격 충전소 [(id, 근거)] (sort_key 순)"""
    members = scorer.station_members()
    inputs = []
    for sid, (t, observed) in cases.items():
        states = [state(sid, cid, observed=observed) for cid in members[sid]]
        inputs.append(
            rec.candidate_input("r1", NOW, station(sid), 1.0, t, filters, states, members, False)
        )
    tabs = scorer.score({"run_id": 1, "predictions": rows}, inputs)
    result = {}
    for name, evaluation in tabs.items():
        rows_ok = sorted(
            (r for r in evaluation["candidate_evaluations"] if r["eligible"]),
            key=lambda r: r["sort_key"],
        )
        result[name] = [(r["station_id"], r["recommendation_source"]) for r in rows_ok]
    return result


def test_ai_scoring_tiers_freshness_and_eta(scorer):
    a, b, c, d = sorted(scorer.station_members())[:4]
    ref = NOW - timedelta(minutes=5)
    fresh, stale = NOW - timedelta(minutes=3), NOW - timedelta(minutes=16)
    rows = forecast_rows(scorer, a, 0.3, ref) + forecast_rows(scorer, b, 0.1, ref)
    fetched = NOW.isoformat()
    result = run_ai(
        scorer,
        rows,
        {
            a: (travel(4, fetched=fetched), fresh),
            b: (travel(20, fetched=fetched), fresh),
            c: (travel(4.5, "estimate"), fresh),  # 예측 없음 → 최근 관측 근거
            d: (travel(3, fetched=fetched), stale),  # 예측 없음 + 16분 지난 관측 → 제외
        },
    )
    # 지금 출발: 예측 근거가 먼저(점수순), 최근 관측 근거는 뒤
    assert result["leave_now"] == [(a, "model"), (b, "model"), (c, "current_state")]
    # 15분 후 도착: 이동 20분은 제외, 최근 관측 근거는 도착 탭에 쓰지 않음
    assert result["arrive_15"] == [(a, "model")]
    assert result["arrive_30"] == [(a, "model"), (b, "model")]


def test_ai_scoring_rejects_expired_forecast(scorer):
    a = sorted(scorer.station_members())[0]
    # 기준시각 25분 전 → 유효기간(기준 + 20분)이 지남
    rows = forecast_rows(scorer, a, 0.1, NOW - timedelta(minutes=25))
    result = run_ai(scorer, rows, {a: (travel(4, fetched=NOW.isoformat()), NOW)})
    assert result["leave_now"] == [(a, "current_state")]
    assert result["arrive_15"] == [] and result["arrive_30"] == []


class FrozenDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return NOW


def test_get_recommendations_uses_ai_result(scorer, monkeypatch):
    # DB · Redis · Directions만 가짜로 두고 요청 → AI 채점 → 응답까지 이어 봄
    members = scorer.station_members()
    a, b = sorted(members)[:2]
    stations = [station(a, lat=ORIGIN[0] + 0.001), station(b, lat=ORIGIN[0] + 0.002)]
    states = {sid: [state(sid, cid) for cid in members[sid]] for sid in (a, b)}

    class Run:
        id, started_at = 1, NOW - timedelta(minutes=4)

    class Db:
        def close(self):
            pass

    raw = {"run_id": 1, "predictions": forecast_rows(scorer, a, 0.2, NOW - timedelta(minutes=5))}
    monkeypatch.setattr(rec, "datetime", FrozenDatetime)
    monkeypatch.setattr(rec, "latest_success_run", lambda db, target: Run)
    monkeypatch.setattr(rec, "load_charger_states", lambda *args: states)
    monkeypatch.setattr(rec, "area_stations", lambda *args: stations)
    monkeypatch.setattr(rec, "failed_after", lambda *args: False)
    monkeypatch.setattr(
        rec,
        "travel_times",
        lambda origin, cands: {s.station_id: travel(4, fetched=NOW.isoformat()) for s, _ in cands},
    )
    monkeypatch.setattr(rec, "load_raw_predictions", lambda: raw)
    resp = rec.get_recommendations(Db(), RecommendationRequest(lat=ORIGIN[0], lng=ORIGIN[1]))
    tabs = {
        r.horizon_minutes: [(x.station.station_id, x.basis) for x in r.recommendations]
        for r in resp.results
    }
    # 예측은 a만 있음 - 지금 출발은 b가 최근 관측 근거로 뒤에, 도착 탭은 a만
    assert tabs == {
        0: [(a, "forecast"), (b, "recent_observation")],
        15: [(a, "forecast")],
        30: [(a, "forecast")],
    }
    first = resp.results[1].recommendations[0]
    assert first.congestion == "low" and first.source == "model"


@pytest.mark.parametrize("late", ["route", "forecast"])
def test_get_recommendations_evidence_after_start_is_kept(scorer, monkeypatch, caplog, late):
    # 실제 순서 그대로: 요청 시작(now) → 길찾기(시계가 흐름) → 예측 읽기 → AI 채점
    # route: 길찾기 조회 시각이 now 뒤 - AI 요청 시각을 now로 넘기면 route_from_future로 세 탭이 비었음 (2026-11-23)
    # forecast: 길찾기를 기다리는 사이 collector가 새 예측을 씀 - 생성 시각이 now 뒤
    members = scorer.station_members()
    a = sorted(members)[0]
    clock = [NOW]

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock[0]

    class Run:
        id, started_at = 1, NOW - timedelta(minutes=4)

    class Db:
        def close(self):
            pass

    def slow_travel(origin, cands):
        clock[0] = NOW + timedelta(seconds=3)
        fetched = NOW + timedelta(seconds=2) if late == "route" else NOW
        return {s.station_id: travel(4, fetched=fetched.isoformat()) for s, _ in cands}

    raw = {"run_id": 1, "predictions": forecast_rows(scorer, a, 0.2, NOW - timedelta(minutes=5))}
    if late == "forecast":
        for row in raw["predictions"]:
            row["components"]["congestion"]["generated_at"] = (
                NOW + timedelta(seconds=2)
            ).isoformat()
    monkeypatch.setattr(rec, "datetime", Clock)
    monkeypatch.setattr(rec, "latest_success_run", lambda db, target: Run)
    monkeypatch.setattr(
        rec, "load_charger_states", lambda *args: {a: [state(a, c) for c in members[a]]}
    )
    monkeypatch.setattr(rec, "area_stations", lambda *args: [station(a, lat=ORIGIN[0] + 0.001)])
    monkeypatch.setattr(rec, "failed_after", lambda *args: False)
    monkeypatch.setattr(rec, "travel_times", slow_travel)
    monkeypatch.setattr(rec, "load_raw_predictions", lambda: raw)
    with caplog.at_level("WARNING", logger=rec.logger.name):
        resp = rec.get_recommendations(Db(), RecommendationRequest(lat=ORIGIN[0], lng=ORIGIN[1]))
    tabs = {
        r.horizon_minutes: [(x.station.station_id, x.basis) for x in r.recommendations]
        for r in resp.results
    }
    assert tabs == {0: [(a, "forecast")], 15: [(a, "forecast")], 30: [(a, "forecast")]}
    assert "모두 제외" not in caplog.text


def test_log_empty_tabs_warns_with_reasons(caplog):
    tabs = {
        "leave_now": {
            "candidate_evaluations": [{"eligible": False}, {"eligible": False}],
            "exclusion_reasons": {"route_from_future": 2, "current_observation_stale": 1},
        },
        "arrive_15": {"candidate_evaluations": [{"eligible": True}], "exclusion_reasons": {}},
        "arrive_30": {"candidate_evaluations": [], "exclusion_reasons": {}},
    }
    with caplog.at_level("WARNING", logger=rec.logger.name):
        rec.log_empty_tabs(tabs)
    # 후보가 있는데 모두 빠진 탭만, 많은 사유부터
    assert len(caplog.records) == 1
    assert "leave_now 탭 후보 2곳 모두 제외 - route_from_future 2, current_observation_stale 1" in (
        caplog.text
    )


def test_ai_scoring_rejects_connector_mismatch(scorer):
    a = sorted(scorer.station_members())[0]
    rows = forecast_rows(scorer, a, 0.1, NOW - timedelta(minutes=5))
    chademo = RecommendationFilters(connector_types=["dc_chademo"])
    result = run_ai(scorer, rows, {a: (travel(4, fetched=NOW.isoformat()), NOW)}, chademo)
    assert result == {"leave_now": [], "arrive_15": [], "arrive_30": []}


# --- 이동시간 ---
