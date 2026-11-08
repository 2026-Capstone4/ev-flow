"""상태 로그 → 모델 입력 피처 - 학습 때와 같은 코드여야 함 (AI-03)

🟡 AI 팀 피처 코드를 받기 전까지 비워 둠. 받으면 build_features만 채움
"""
from dataclasses import dataclass
from datetime import datetime

import numpy as np

from app.schemas import StatusRow


class FeaturesNotReady(Exception):
    """피처 생성 코드가 아직 없음 - /predict가 503으로 응답함"""


@dataclass
class Features:
    station_ids: list[str]  # matrix의 i번째 행 = station_ids[i]
    matrix: np.ndarray
    # 학습 때 피처 이름 · 순서 그대로 - DMatrix에 넣으면 모델에 저장된 이름과 다를 때 XGBoost가 에러를 냄
    names: list[str]


def build_features(base_time: datetime, rows: list[StatusRow]) -> Features:
    """시간대 · 요일 피처는 KST로 변환해 만듦 (BE-09)"""
    raise FeaturesNotReady("피처 생성 코드 미구현 (AI-03)")
