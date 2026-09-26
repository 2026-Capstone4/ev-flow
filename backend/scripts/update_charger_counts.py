import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.collector.api_client import get_charger_info
from app.db.models import CityStation, ServiceAreaStation
from app.db.session import SessionLocal

# 추천 화면 표시용 완속·중속 개수를 기존 충전소 행에만 채움.
# *_chargers(수집 대상)는 건드리지 않음 - import 재실행 시 급속 목록이 바뀌어 수집 대상이 흔들리는 걸 피하기 위함.
# 1회성으로 돌리면 되고, 값이 오래됐다 싶을 때만 다시 실행 (API 2콜)
TARGETS = [
    ("11440", CityStation),  # 마포구
    ("44130", ServiceAreaStation),  # 천안 - 휴게소 statId만 DB에 있으므로 나머지는 무시됨
]
PAGE_SIZE = 9999  # 천안 7,295건 - 2000이면 잘림
MAX_SLOW_KW = 11
MIN_FAST_KW = 50


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


def classify(item: dict) -> str | None:
    # 급속 수집 대상과 같은 기준으로 삭제·이용제한 충전기는 제외함
    if (item.get("delYn") or "N") != "N" or (item.get("limitYn") or "N") != "N":
        return None
    try:
        output = float(item.get("output") or 0)
    except ValueError:
        return None
    if output <= 0:
        return None  # 출력 미기재 - 어느 구간인지 알 수 없어 세지 않음
    if output <= MAX_SLOW_KW:
        return "slow"
    if output < MIN_FAST_KW:
        return "mid"
    return None


def update_counts(zscode: str, station_model):
    # API 조회가 실패하면 예외로 멈춤 - 빈 응답을 0개로 덮어쓰지 않기 위함
    items = fetch(zscode)
    if not items:
        raise RuntimeError(f"지역 {zscode} 응답이 비어 있음 - 갱신 중단")

    slow, mid = Counter(), Counter()
    for item in items:
        kind = classify(item)
        if kind == "slow":
            slow[item["statId"]] += 1
        elif kind == "mid":
            mid[item["statId"]] += 1

    db = SessionLocal()
    try:
        stations = db.query(station_model).all()
        for station in stations:
            station.slow_charger_count = slow[station.station_id]
            station.mid_charger_count = mid[station.station_id]
        db.commit()
        print(
            f"[{station_model.__tablename__}] {len(stations)}개소 갱신 - "
            f"완속 {sum(s.slow_charger_count for s in stations)}기, "
            f"중속 {sum(s.mid_charger_count for s in stations)}기"
        )
    finally:
        db.close()


if __name__ == "__main__":
    for zscode, station_model in TARGETS:
        update_counts(zscode, station_model)
