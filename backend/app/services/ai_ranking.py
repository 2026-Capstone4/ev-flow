"""AI 추천 모듈 채점 - 추천 순위 규칙을 AI 패키지 코드 그대로 씀 (docs/api/user.md 3번, 2026-11-22)

- AI 패키지의 공식 백엔드 연동(run_recommendation.score_snapshot → rank_candidates.score_tab)을 그대로 부름
- 채점 모듈은 표준 라이브러리만 써서 api에서 불러도 모델 · pandas를 올리지 않음
- 패키지는 ml · producer와 같은 폴더(compose 마운트 /package)라 버전이 항상 같고, 교체 뒤 api도 재시작해야 반영됨
"""

import importlib
import logging
import sys
import threading
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# 응답 탭(h분) → AI 탭 이름. 0 = 지금 출발, 15 · 30 = h분 후 도착
TABS = {0: "leave_now", 15: "arrive_15", 30: "arrive_30"}


class AiPackageUnavailable(Exception):
    """패키지가 없거나 읽지 못함 - 추천은 빈 목록으로 응답 (조회 API는 실패시키지 않음)"""


@dataclass(frozen=True)
class Scorer:
    module: object  # run_recommendation
    config: dict  # recommendation_settings.json
    support: object  # OccupancyModelSupport - 모델 범위 충전기 목록

    def station_members(self) -> dict[str, tuple[str, ...]]:
        return dict(self.support.station_members)

    def score(self, prediction: dict, candidates: list[dict]) -> dict[str, dict]:
        """탭 이름 → AI score_tab 결과(candidate_evaluations · exclusion_reasons)"""
        result = self.module.score_snapshot(
            prediction,
            {"run_id": prediction["run_id"], "candidates": candidates},
            self.support,
            self.config,
            tabs=tuple(TABS.values()),
        )
        return result["tabs"]


_lock = threading.Lock()
_scorer: Scorer | None = None


def get_scorer() -> Scorer:
    """처음 부를 때 한 번만 읽음 - 실패하면 다음 요청에서 다시 시도"""
    global _scorer
    with _lock:
        if _scorer is None:
            _scorer = _load(Path(settings.ai_package_dir))
        return _scorer


def _load(home: Path) -> Scorer:
    if not (home / "run_recommendation.py").is_file():
        raise AiPackageUnavailable(f"AI 패키지 없음: {home}")
    try:
        # 맨 뒤에 붙여 우리 모듈 이름을 가리지 않게 함 (패키지가 import 때 자기 경로를 앞에 넣는 것은 패키지 동작)
        if str(home) not in sys.path:
            sys.path.append(str(home))
        module = importlib.import_module("run_recommendation")
        config = module.read(home / "recommendation_settings.json")
        support = module.load_scoring_support(home, config)
    except Exception as exc:
        raise AiPackageUnavailable(f"AI 패키지를 읽지 못함: {home}") from exc
    logger.info(
        "AI 추천 채점 로드 - %s, 충전소 %d곳", support.model_version, len(support.station_members)
    )
    return Scorer(module, config, support)
