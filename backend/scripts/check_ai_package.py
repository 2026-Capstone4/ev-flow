"""AI 패키지가 백엔드 계약(docs/contracts)에 맞는지 확인 - AI 팀이 패키지를 넘기기 전에 돌림

ml/check_package.sh가 부름 (직접 실행할 일은 없음):
  1) ml 이미지: 패키지 예제(DB 없음)로 예측 → answer.json
  2) api 이미지: 이 스크립트가 그 응답을 백엔드의 실제 변환 · 채점 코드에 넣어 봄
규칙을 여기 따로 적지 않고 백엔드 코드를 그대로 불러 씀 - 백엔드가 바뀌면 검사도 같이 바뀜
DB가 있어야 하는 부분(ml_read · ml_checkpoint 컬럼, EVFLOW_SOURCE_ID)은 확인하지 못함 - 서버 배포 뒤 확인
"""

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
# app.config 필수 설정 - 이 검사는 DB · 공공 API를 쓰지 않음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://unused:unused@localhost:5432/unused")
os.environ.setdefault("EV_SERVICE_KEY", "unused")

from app.collector.prediction import build_raw, build_value, convert_row  # noqa: E402
from app.services import ai_ranking  # noqa: E402

REQUIRED_FILES = (
    "backend_app.py",
    "run_recommendation.py",
    "recommendation_settings.json",
    "checkpoint_schema.json",
)
failures: list[str] = []


def ok(msg: str) -> None:
    print(f"[통과] {msg}")


def fail(msg: str) -> None:
    failures.append(msg)
    print(f"[실패] {msg}")


def note(msg: str) -> None:
    print(f"[참고] {msg}")


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def same_shape(example, actual, path="") -> list[str]:
    """예시에 있는 필드가 실제 값에도 같은 JSON 타입으로 있는지

    null은 결측이라 어느 쪽이든 통과. 배열은 예시 첫 원소 모양을 실제 원소 전부와 비교
    """
    if example is None or actual is None:
        return []
    if isinstance(example, dict):
        if not isinstance(actual, dict):
            return [f"{path or '(최상위)'}: 객체가 아님"]
        errors = []
        for key, value in example.items():
            if key not in actual:
                errors.append(f"{path}.{key}: 없음")
            else:
                errors += same_shape(value, actual[key], f"{path}.{key}")
        return errors
    if isinstance(example, list):
        if not isinstance(actual, list):
            return [f"{path}: 배열이 아님"]
        if example and isinstance(example[0], dict):
            return [
                e
                for i, item in enumerate(actual)
                for e in same_shape(example[0], item, f"{path}[{i}]")
            ]
        return []
    if _kind(example) != _kind(actual):
        return [f"{path}: {_kind(example)}이어야 하는데 {_kind(actual)}"]
    return []


def _kind(value) -> str:
    if isinstance(value, bool):  # bool은 int의 하위 타입이라 먼저 봄
        return "true/false"
    if isinstance(value, (int, float)):
        return "숫자"
    return "문자열" if isinstance(value, str) else type(value).__name__


def report_shape(title: str, errors: list[str]) -> None:
    if errors:
        fail(f"{title} 필드가 예시와 다름 {len(errors)}곳 - " + ", ".join(errors[:10]))
    else:
        ok(f"{title} 필드 이름 · 타입이 예시와 같음")


def check_prediction(prediction: dict, contract: dict) -> None:
    report_shape("ml 응답", same_shape(contract, prediction))
    rows = prediction.get("predictions") or []
    dropped_rows = [
        f"{r.get('station_id')} {r.get('horizon_minutes')}분"
        for r in rows
        if convert_row(r) is None
    ]
    if dropped_rows:
        fail(
            f"collector가 버리는 행 {len(dropped_rows)}개 (혼잡도 없음 · 형식 다름) - "
            + ", ".join(dropped_rows[:10])
        )
    targets = {
        r["station_id"]
        for r in rows
        if isinstance(r, dict) and isinstance(r.get("station_id"), str)
    }
    now = datetime.now(UTC)
    try:
        value, dropped = build_value(prediction, targets, now, prediction.get("run_id"), now)
    except ValueError as e:
        fail(f"collector 변환 실패 - {e}")
        return
    if dropped:
        fail(f"collector 변환에서 {dropped}개소가 빠짐 - 15 · 30분이 하나씩 다 있어야 저장됨")
    else:
        ok(f"collector 변환 - {len(value['stations'])}개소 모두 저장")
    waits = sum(
        1 for cells in value["stations"].values() for c in cells if c["wait_p50"] is not None
    )
    note(f"대기 값이 있는 칸 {waits}개 - 예제 데이터에 대기 체크포인트가 없으면 0개가 정상")


def check_scoring(prediction: dict, contract: dict) -> None:
    try:
        scorer = ai_ranking.get_scorer()
        # api와 같은 인자 (ai_ranking.Scorer.score). fixture=True만 다름 - 예제 데이터는 과거 시각(2026-11-12)이라
        result = scorer.module.score_snapshot(
            build_raw(prediction),
            contract["request"],
            scorer.support,
            scorer.config,
            tabs=tuple(ai_ranking.TABS.values()),
            fixture=True,
        )
    except Exception as e:
        fail(f"채점 함수(score_snapshot) 호출 실패 - {type(e).__name__}: {e}")
        return
    report_shape("채점 결과", same_shape(contract["result"], result))
    tabs = set(result.get("tabs") or {}) if isinstance(result, dict) else set()
    if tabs != set(ai_ranking.TABS.values()):
        fail(f"채점 탭이 다름 - {sorted(tabs)} (leave_now · arrive_15 · arrive_30이어야 함)")
        return
    # 같은 예제 데이터 · 같은 후보라 채점 규칙이 그대로면 결과도 예시와 같아야 함 - 다르면 의도한 변경인지 확인
    for tab, expected in contract["result"]["tabs"].items():
        got = [
            (
                e.get("station_id"),
                e.get("eligible"),
                e.get("recommendation_source"),
                e.get("selected_horizon_minutes"),
            )
            for e in result["tabs"][tab]["candidate_evaluations"]
        ]
        want = [
            (
                e["station_id"],
                e["eligible"],
                e["recommendation_source"],
                e["selected_horizon_minutes"],
            )
            for e in expected["candidate_evaluations"]
        ]
        if got != want:
            note(
                f"{tab} 결과가 예시와 다름 {got} (예시 {want}) - 채점 규칙을 바꿨다면 백엔드에 알려 주세요"
            )
    ok("채점 함수 호출 · 탭 3개")


def main() -> None:
    parser = argparse.ArgumentParser(description="AI 패키지 백엔드 계약 검사")
    parser.add_argument(
        "--answer", type=Path, required=True, help="run_recommendation.py --example 출력"
    )
    parser.add_argument("--contracts", type=Path, default=Path("/contracts"))
    args = parser.parse_args()

    package = Path(os.environ.get("AI_PACKAGE_DIR", "/package"))
    missing = [name for name in REQUIRED_FILES if not (package / name).is_file()]
    if missing:
        fail(f"패키지에 파일 없음 - {', '.join(missing)}")
    else:
        ok("패키지 파일 구성")

    answer = read(args.answer)
    prediction = answer.get("integrated_prediction") or {}
    if answer.get("integrated_status") == 200:
        ok(f"예제 예측 HTTP 200 ({prediction.get('status')})")
    else:
        fail(
            f"예제 예측 HTTP {answer.get('integrated_status')} - 200이어야 함 "
            f"(reason {prediction.get('reason')})"
        )

    check_prediction(prediction, read(args.contracts / "ml_predict_response.json"))
    check_scoring(prediction, read(args.contracts / "score_snapshot.json"))

    print()
    if failures:
        print(
            f"실패 {len(failures)}건 - 백엔드와 맞지 않는 부분이 있어 이대로 넘기면 서버에서 예측 · 추천이 빠짐"
        )
        sys.exit(1)
    print(
        "모두 통과 - DB가 필요한 부분(ml_read · ml_checkpoint 컬럼, EVFLOW_SOURCE_ID)은 서버 배포 뒤 확인"
    )


if __name__ == "__main__":
    main()
