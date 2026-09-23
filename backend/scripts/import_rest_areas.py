import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.collector.api_client import get_charger_info
from app.db.models import ServiceAreaCharger, ServiceAreaStation
from app.db.session import SessionLocal

MAPPING_PATH = Path(__file__).resolve().parent.parent / "data" / "rest_area_mapping.csv"
ZSCODES = ["44130"]  # 천안시
PAGE_SIZE = 9999  # 천안 7,295건 - 2000이면 잘림
MIN_OUTPUT_KW = 50


def fetch(zscode: str) -> list[dict]:
    items = []
    page_no = 1
    while True:
        page = get_charger_info(page_no=page_no, num_of_rows=PAGE_SIZE, zscode=zscode)
        if not page:
            break
        items.extend(page)
        if len(page) < PAGE_SIZE:
            break
        page_no += 1
    return items


def is_target(item: dict, target_ids: set[str]) -> bool:
    # 같은 휴게소가 사업자마다 다른 이름으로 등록돼 있음
    # ('천안호두(부산)휴게소' vs '천안호두휴게소(부산방향)(급)') - 이름 필터는 누락·오탐이 생김.
    # 그래서 좌표로 검증해둔 rest_area_mapping.csv 의 statId 목록을 기준으로 씀.
    if item.get("statId") not in target_ids:
        return False
    if (item.get("limitYn") or "N") != "N":
        return False
    if (item.get("delYn") or "N") != "N":
        return False
    return int(item.get("output") or 0) >= MIN_OUTPUT_KW


def import_rest_areas():
    with open(MAPPING_PATH, encoding="utf-8-sig") as f:
        mapping = {row["statId"]: row for row in csv.DictReader(f)}
    target_ids = set(mapping)

    items = []
    for zscode in ZSCODES:
        items.extend(fetch(zscode))

    targets = [i for i in items if is_target(i, target_ids)]

    db = SessionLocal()
    try:
        seen_stations = set()
        for item in targets:
            station_id = item["statId"]
            if station_id not in seen_stations:
                seen_stations.add(station_id)
                station = db.get(ServiceAreaStation, station_id) or ServiceAreaStation(station_id=station_id)
                station.name = item.get("statNm")
                station.addr = item.get("addr")
                # 주소 앞 두 토큰에서 뽑음 - import_stations.py와 같은 방식
                parts = (item.get("addr") or "").split()
                station.sido = parts[0] if parts else None
                station.gugun = parts[1] if len(parts) > 1 else None
                station.lat = float(item["lat"]) if item.get("lat") else None
                station.lng = float(item["lng"]) if item.get("lng") else None
                station.operator = item.get("busiNm")
                station.service_area_name = mapping[station_id]["rest_area"]
                station.route = mapping[station_id]["route"]
                station.direction = mapping[station_id]["direction"]
                db.add(station)

            charger_id = item["chgerId"]
            charger = db.get(ServiceAreaCharger, (station_id, charger_id)) or ServiceAreaCharger(
                station_id=station_id, charger_id=charger_id
            )
            charger.charger_type = item.get("chgerType")
            charger.capacity = item.get("output")
            charger.is_limited = False
            db.add(charger)

        db.commit()
        print(f"휴게소 {len(seen_stations)}개 statId, 충전기 {len(targets)}기 저장 완료")

        missing = target_ids - seen_stations
        if missing:
            # 폐쇄·statId 변경 시 조용히 누락되는 걸 막기 위해 명시적으로 알림
            print(f"[경고] 매핑 CSV에 있으나 API 응답에 없는 statId: {sorted(missing)}")
    finally:
        db.close()


if __name__ == "__main__":
    import_rest_areas()
