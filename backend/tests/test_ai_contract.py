"""AI 연동 계약 예시(docs/contracts)가 실제 백엔드 코드와 맞는지 확인

예시 파일은 AI 팀이 패키지를 맞추는 기준 - 백엔드가 읽거나 보내는 필드를 바꾸면 여기서 깨지므로 예시도 함께 고쳐야 함
"""

import json
import os
from datetime import UTC, datetime
from pathlib import Path

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from test_recommendations import charger, station  # noqa: E402

from app.collector.prediction import build_raw, build_value  # noqa: E402
from app.schemas.recommendation import RecommendationFilters  # noqa: E402
from app.services import recommendations as rec  # noqa: E402
from app.services.snapshot import ChargerState  # noqa: E402

CONTRACTS = Path(__file__).resolve().parents[2] / "docs" / "contracts"
PREDICT = json.loads((CONTRACTS / "ml_predict_response.json").read_text(encoding="utf-8"))
SCORE = json.loads((CONTRACTS / "score_snapshot.json").read_text(encoding="utf-8"))
CANDIDATE = SCORE["request"]["candidates"][0]

SID = "CV004090"
CIDS = ("01", "02", "03", "04")
OBSERVED = datetime(2026, 11, 12, 9, 1, 29, 912489, tzinfo=UTC)
REQUEST_AT = datetime(2026, 11, 12, 9, 5, 1, tzinfo=UTC)
TRAVEL = rec.Travel(2.0, 2, 343, "directions", REQUEST_AT.isoformat())


# --- ml 응답 (ml_predict_response.json) ---


def test_predict_example_passes_collector_checks():
    value, dropped = build_value(PREDICT, {SID}, OBSERVED, PREDICT["run_id"], REQUEST_AT)
    assert dropped == 0
    assert value["model_version"] == PREDICT["deployment"]["deployment_id"]
    assert value["model_versions"] == PREDICT["predictions"][0]["model_versions"]
    fifteen, thirty = value["stations"][SID]
    assert (fifteen["congestion"], fifteen["wait_p50"], fifteen["wait_p90"]) == ("low", 2.0, 9.5)
    # 대기만 빠진 행도 혼잡도로 저장됨
    assert thirty["congestion"] == "low" and thirty["wait_p50"] is None


def test_predict_example_raw_passes_components_unchanged():
    raw = build_raw(PREDICT)
    for key in ("run_id", "clock_mode", "prediction_snapshot_id"):
        assert raw[key] == PREDICT[key]
    for got, row in zip(raw["predictions"], PREDICT["predictions"], strict=True):
        assert got["components"] == row["components"]


# --- 채점 요청 · 결과 (score_snapshot.json) ---


def test_candidate_input_matches_example():
    states = [
        ChargerState(SID, cid, "available", ["dc_combo"], 100, None, stat="2", observed_at=OBSERVED)
        for cid in CIDS
    ]
    got = rec.candidate_input(
        CANDIDATE["request_id"],
        REQUEST_AT,
        station(SID, chargers=[charger(cid=cid) for cid in CIDS]),
        0.343,
        TRAVEL,
        RecommendationFilters(connector_types=["dc_combo"]),
        states,
        {SID: CIDS},
        True,
    )
    assert got == CANDIDATE


def test_pick_reads_example_result():
    levels = rec.forecast_levels(PREDICT)
    stations = {SID: station(SID)}
    for tab, evaluation in SCORE["result"]["tabs"].items():
        picked = rec.pick(evaluation, stations, {SID: TRAVEL}, levels, RecommendationFilters())
        assert [p.station.station_id for p in picked] == [SID], tab
        assert picked[0].basis == "forecast" and picked[0].congestion == "low"
