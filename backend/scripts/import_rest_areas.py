import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.collector.api_client import get_charger_info
from app.db.models import ServiceAreaCharger, ServiceAreaStation
from app.db.session import SessionLocal

# 천안 대조군 9 statId - 휴게소명 · 노선 · 방향(상행/하행)을 이 CSV로 채움.
# 옛 앱 · 기존 휴게소 API는 direction이 있는 행만 보여 주므로 여기 있는 휴게소만 보임
MAPPING_PATH = Path(__file__).resolve().parent.parent / "data" / "rest_area_mapping.csv"
KIND = "C0"  # 휴게시설 전체 (C001 고속도로 휴게소 · C002 지방도로 휴게소 · C003 쉼터)
KIND_DETAIL = "C001"  # 고속도로 휴게소
PAGE_SIZE = 1000  # kind=C0 약 2,700건 - 9,999건 한 번에 받으면 504 (11/23 실측)
INFO_RETRIES = 2
MIN_OUTPUT_KW = 50


def fetch() -> list[dict]:
    items = []
    page_no = 1
    while True:
        page = get_charger_info(
            page_no=page_no, num_of_rows=PAGE_SIZE, kind=KIND, max_retries=INFO_RETRIES
        )
        if not page:
            break
        items.extend(page)
        if len(page) < PAGE_SIZE:
            break
        page_no += 1
    return items


def is_target(item: dict, control_ids: set[str]) -> bool:
    if (item.get("limitYn") or "N") != "N":
        return False
    if (item.get("delYn") or "N") != "N":
        return False
    if int(item.get("output") or 0) < MIN_OUTPUT_KW:
        return False
    if item.get("statId") in control_ids:
        return True
    # 고속도로 휴게소 중 이름에 '휴게'가 있는 것만 - C001에 TG 주차장 · 임시주차장도 섞여 있음 (11/23 실측 55기)
    return item.get("kindDetail") == KIND_DETAIL and "휴게" in (item.get("statNm") or "")


def import_rest_areas():
    with open(MAPPING_PATH, encoding="utf-8-sig") as f:
        mapping = {row["statId"]: row for row in csv.DictReader(f)}
    control_ids = set(mapping)

    targets = [i for i in fetch() if is_target(i, control_ids)]

    db = SessionLocal()
    try:
        seen_stations = set()
        for item in targets:
            station_id = item["statId"]
            if station_id not in seen_stations:
                seen_stations.add(station_id)
                station = db.get(ServiceAreaStation, station_id) or ServiceAreaStation(
                    station_id=station_id
                )
                station.name = item.get("statNm")
                station.addr = item.get("addr")
                # 주소 앞 두 토큰에서 뽑음 - import_stations.py와 같은 방식
                parts = (item.get("addr") or "").split()
                station.sido = parts[0] if parts else None
                station.gugun = parts[1] if len(parts) > 1 else None
                station.lat = float(item["lat"]) if item.get("lat") else None
                station.lng = float(item["lng"]) if item.get("lng") else None
                station.operator = item.get("busiNm")
                # 대조군만 채움 - 나머지 휴게소의 이름 · 노선 · 방향은 노선 매핑 단계에서 따로 채우므로 덮어쓰지 않음
                if station_id in mapping:
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

        missing = control_ids - seen_stations
        if missing:
            # 폐쇄·statId 변경 시 조용히 누락되는 걸 막기 위해 명시적으로 알림
            print(f"[경고] 매핑 CSV에 있으나 API 응답에 없는 statId: {sorted(missing)}")
    finally:
        db.close()


if __name__ == "__main__":
    import_rest_areas()
