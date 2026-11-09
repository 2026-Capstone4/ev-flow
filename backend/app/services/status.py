from datetime import datetime, timedelta

# 원본 stat → 응답 충전기 상태 (docs/api/README.md 충전기 상태). 표에 없는 0 · 1 · 9 등은 unknown
STAT_TO_STATUS = {
    "2": "available",
    "3": "charging",
    "6": "charging",  # 예약중 - 도착해도 바로 쓸 수 없어 충전 중과 같게 봄
    "4": "stopped",
    "5": "maintenance",
}

# chgerType → FLT-001 필터 단위 커넥터 타입
CONNECTOR_TYPES = {
    "01": ["dc_chademo"],
    "03": ["dc_chademo", "ac3"],
    "04": ["dc_combo"],
    "05": ["dc_chademo", "dc_combo"],
    "06": ["dc_chademo", "ac3", "dc_combo"],
    "07": ["ac3"],
    "09": ["nacs"],
    "10": ["dc_combo", "nacs"],
}
BUS_CHARGER_TYPE = "11"  # 버스 차고지 충전기 - 충전기 목록 · 대수 집계에서 뺌

DELAYED_AFTER = timedelta(minutes=10)
STALE_AFTER = timedelta(minutes=20)  # 이후로는 충전기 상태를 모두 unknown으로 보고 예측은 기준선으로 대체
MIN_CONFIRMED_RATIO = 0.8  # 상태 확인 비율이 이보다 낮으면 현재 혼잡도 unknown · 예측 기준선


def is_stale(updated_at: datetime, now: datetime) -> bool:
    return now - updated_at >= STALE_AFTER


def to_charger_status(stat: str | None, stale: bool) -> str:
    if stale:
        return "unknown"
    return STAT_TO_STATUS.get(stat, "unknown")


def to_capacity_kw(capacity: str) -> int | float:
    # API output 원본이 문자열로 저장돼 있음 ("100")
    value = float(capacity)
    return int(value) if value.is_integer() else value


def elapsed_quality(updated_at: datetime, now: datetime) -> str:
    """응답 최상위 dataQuality - 경과 시간만 반영해 missing은 나오지 않음"""
    elapsed = now - updated_at
    if elapsed >= STALE_AFTER:
        return "baseline"
    if elapsed >= DELAYED_AFTER:
        return "delayed"
    return "normal"


def confirmed_ratio(statuses: list[str]) -> float:
    return sum(s != "unknown" for s in statuses) / len(statuses)


def station_quality(statuses: list[str], updated_at: datetime, now: datetime) -> str:
    """충전소별 dataQuality - 여러 조건에 해당하면 baseline > delayed > missing 순으로 하나만"""
    ratio = confirmed_ratio(statuses)
    elapsed = elapsed_quality(updated_at, now)
    if ratio < MIN_CONFIRMED_RATIO or elapsed == "baseline":
        return "baseline"
    if elapsed == "delayed":
        return "delayed"
    if ratio < 1:
        return "missing"
    return "normal"


def current_congestion(statuses: list[str]) -> str:
    """현재 혼잡도 (분석서 p.9). statuses는 버스전용을 뺀 충전기 상태 - 비어 있으면 안 됨"""
    confirmed = sum(s != "unknown" for s in statuses)
    return congestion_from_counts(len(statuses), confirmed, statuses.count("available"), statuses.count("charging"))


def congestion_from_counts(total: int, confirmed: int, available: int, charging: int) -> str:
    """current_congestion의 개수 버전 - 기준선 계산이 SQL 집계 결과(회차 × 충전소)에 그대로 씀.
    total은 버스전용을 뺀 충전기 수, confirmed는 그중 상태를 아는 충전기 수"""
    if confirmed / total < MIN_CONFIRMED_RATIO:
        return "unknown"
    # 분석서는 '모두 점검 중 · 사용 불가'로 정의하나, 확인 비율 80~100%에서 확인된 충전기가 모두
    # 운영중지 · 점검중이면 점유율 분모가 0이라 어느 단계에도 들지 않음 - 확인된 충전기 기준으로 넓힘
    if available + charging == 0:
        return "unavailable"
    if available == 0:
        return "high"
    # 점유율 = 충전 중 ÷ (사용 가능 + 충전 중) - 운영중지 · 점검중 · 미확인은 분모에서 뺌
    if charging / (available + charging) < 0.5 and available >= 2:
        return "low"
    return "medium"
