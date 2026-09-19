import xml.etree.ElementTree as ET

import httpx

from app.config import settings

STATUS_URL = "https://apis.data.go.kr/B552584/EvCharger/getChargerStatus"
INFO_URL = "https://apis.data.go.kr/B552584/EvCharger/getChargerInfo"


def get_charger_status(page_no: int = 1, num_of_rows: int = 100, zcode: str | None = None) -> list[dict]:
    params = {
        "serviceKey": settings.ev_service_key.get_secret_value(),
        "pageNo": page_no,
        "numOfRows": num_of_rows,
    }
    if zcode:
        params["zcode"] = zcode

    resp = httpx.get(STATUS_URL, params=params, timeout=10)
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    items = []
    for item in root.findall(".//item"):
        items.append({child.tag: child.text for child in item})
    return items


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
