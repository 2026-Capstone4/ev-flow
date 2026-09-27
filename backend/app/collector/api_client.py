import httpx

from app.config import settings

# getChargerStatus는 실시간 데이터가 있는 충전소가 극소수라 사용하지 않음
# getChargerInfo 응답에 stat/statUpdDt 등 실시간 상태가 이미 들어있어 이걸로 대체함
# 경위는 docs/decisions.md "실시간 상태 수집 API" 참고
INFO_URL = "https://apis.data.go.kr/B552584/EvCharger/getChargerInfo"


def get_charger_info(
    page_no: int = 1,
    num_of_rows: int = 100,
    zcode: str | None = None,
    zscode: str | None = None,
) -> list[dict]:
    params = {
        "serviceKey": settings.ev_service_key.get_secret_value(),
        "pageNo": page_no,
        "numOfRows": num_of_rows,
        "dataType": "JSON",
    }
    if zcode:
        params["zcode"] = zcode
    if zscode:
        params["zscode"] = zscode

    resp = httpx.get(INFO_URL, params=params, timeout=10)
    resp.raise_for_status()

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
