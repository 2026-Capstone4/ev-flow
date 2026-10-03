import httpx

from app.config import settings

# getChargerInfo - 충전기 정보 + 상태 전체 스냅샷. 상태값은 원천이 약 30분 배치로 갱신됨(2026-10-02 실측)
# getChargerStatus - 최근 period분 안에 상태가 바뀐 충전기만 주는 증분 API. 5분 수집의 주 데이터원
# 경위는 docs/decisions.md "실시간 상태 수집 API" 참고
BASE_URL = "https://apis.data.go.kr/B552584/EvCharger"
INFO_URL = f"{BASE_URL}/getChargerInfo"
STATUS_URL = f"{BASE_URL}/getChargerStatus"


def _fetch_items(url: str, params: dict) -> list[dict]:
    params = {
        "serviceKey": settings.ev_service_key.get_secret_value(),
        "dataType": "JSON",
        **params,
    }
    # httpx 예외 메시지에는 serviceKey가 든 요청 URL이 평문으로 들어감 - 호출부의 logger.exception으로
    # 로그에 남지 않도록 원래 예외를 버리고(from None) 엔드포인트 이름 · 상태 코드만 남김
    name = url.rsplit("/", 1)[-1]
    try:
        resp = httpx.get(url, params=params, timeout=10)
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise RuntimeError(f"{name} HTTP {e.response.status_code}") from None
    except httpx.HTTPError as e:
        raise RuntimeError(f"{name} 요청 실패: {type(e).__name__}") from None

    data = resp.json()
    items = data.get("items")
    if not items:
        return []

    item = items.get("item")
    if item is None:
        return []
    if isinstance(item, dict):
        return [item]
    return item


def get_charger_info(
    page_no: int = 1,
    num_of_rows: int = 100,
    zcode: str | None = None,
    zscode: str | None = None,
) -> list[dict]:
    params = {"pageNo": page_no, "numOfRows": num_of_rows}
    if zcode:
        params["zcode"] = zcode
    if zscode:
        params["zscode"] = zscode
    return _fetch_items(INFO_URL, params)


def get_charger_status(
    period: int = 5,
    page_no: int = 1,
    num_of_rows: int = 100,
    zcode: str | None = None,
    zscode: str | None = None,
) -> list[dict]:
    # period - 상태갱신 조회 범위(분), API 허용 범위 1~10
    # statUpdDt는 상태가 그대로여도 갱신되는 하트비트라 '상태 변경 시각'으로 쓰면 안 됨 - stat 변화로 판단할 것
    params = {"pageNo": page_no, "numOfRows": num_of_rows, "period": period}
    if zcode:
        params["zcode"] = zcode
    if zscode:
        params["zscode"] = zscode
    return _fetch_items(STATUS_URL, params)
