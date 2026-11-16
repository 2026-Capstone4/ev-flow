import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.collector.api_client import get_charger_info
from app.collector.scheduler import JOBS, PAGE_SIZE
from app.db.models import LiveCharger, LiveStation
from app.db.session import SessionLocal
from app.services.status import BUS_CHARGER_TYPE
from scripts.update_charger_counts import classify

# 서울 실시간 표시 대상(live_stations · live_chargers)을 처음 채움. 서울 Info 전체(약 8페이지)를 한 번 받음.
# 대상: 삭제 제외 · 50kW 이상 · 이용제한 없음 · 버스형(11) 제외 · 마포(zscode 11440) 제외 - 마포 목록(build_station_list.py)과 같은 기준.
# 상태 로그는 collector 서울 잡이 첫 회차부터 채움 (대상이 비어 있으면 그 잡은 회차마다 대상 0기로 기록됨).
# 이미 채워져 있으면 멈춤. 페이지가 하나라도 실패하면 DB에 아무것도 쓰지 않음
#
#   python scripts/init_live_chargers.py            받아서 요약만 (DB에 쓰지 않음)
#   python scripts/init_live_chargers.py --commit   채움
MAPO_ZSCODE = "11440"
MIN_FAST_KW = 50
# scheduler.JOBS의 서울 잡 설정을 그대로 씀 - 조회 지역 · Info 재시도 횟수
SEOUL_AREA, _, _, SEOUL_OPTIONS = next(job for job in JOBS if job[1] is LiveCharger)


def fetch_seoul() -> list[dict]:
    items, page_no = [], 1
    while True:
        page = get_charger_info(
            page_no=page_no,
            num_of_rows=PAGE_SIZE,
            max_retries=SEOUL_OPTIONS["info_retries"],
            **SEOUL_AREA,
        )
        items.extend(page)
        print(f"  {page_no}페이지 {len(page)}건")
        if len(page) < PAGE_SIZE:
            return items
        page_no += 1


def is_fast_target(item: dict) -> bool:
    try:
        output = float(item.get("output") or 0)
    except ValueError:
        return False
    return (
        item.get("delYn") != "Y"
        and item.get("limitYn") == "N"
        and output >= MIN_FAST_KW
        and item.get("chgerType") != BUS_CHARGER_TYPE
        and item.get("zscode") != MAPO_ZSCODE
    )


def to_float(value) -> float | None:
    try:
        return float(value) if value else None
    except ValueError:
        return None


def main(commit: bool) -> int:
    db = SessionLocal()
    try:
        if db.query(LiveCharger).first() is not None:
            print("live_chargers가 이미 채워져 있음 - 중단")
            return 1

        print(f"서울 Info 받는 중 ({SEOUL_AREA})")
        items = fetch_seoul()
        # 페이지 사이에 데이터가 바뀌어 같은 충전기가 두 번 오면 한 번만 넣음
        chargers = {(i["statId"], i["chgerId"]): i for i in items if is_fast_target(i)}
        # 충전소 정보는 그 충전소의 아무 충전기 행
        stations = {sid: item for (sid, _), item in chargers.items()}
        # 추천 화면 표시용 완속 · 중속 개수 - update_charger_counts.py와 같은 기준으로 같은 Info에서 셈
        slow, mid = Counter(), Counter()
        for item in items:
            if item.get("statId") in stations:
                kind = classify(item)
                if kind == "slow":
                    slow[item["statId"]] += 1
                elif kind == "mid":
                    mid[item["statId"]] += 1

        print(
            f"서울 전체 {len(items)}건 → 대상 충전기 {len(chargers)}기 / 충전소 {len(stations)}곳"
        )
        print(
            f"  (11/15 실측 3,561기 / 1,560곳) · 완속 {sum(slow.values())}기 · 중속 {sum(mid.values())}기"
        )
        if not commit:
            print("--commit 없이 실행 - DB에 쓰지 않음")
            return 0

        for sid, item in stations.items():
            parts = (item.get("addr") or "").split()
            db.add(
                LiveStation(
                    station_id=sid,
                    name=item.get("statNm"),
                    addr=item.get("addr"),
                    sido=parts[0] if parts else None,
                    gugun=parts[1] if len(parts) > 1 else None,
                    lat=to_float(item.get("lat")),
                    lng=to_float(item.get("lng")),
                    operator=item.get("busiNm"),
                    slow_charger_count=slow[sid],
                    mid_charger_count=mid[sid],
                )
            )
        db.flush()  # 충전기 FK보다 먼저
        for (sid, cid), item in chargers.items():
            db.add(
                LiveCharger(
                    station_id=sid,
                    charger_id=cid,
                    charger_type=item.get("chgerType"),
                    capacity=item.get("output"),
                    is_limited=False,
                )
            )
        db.commit()
        print(f"저장 완료 - 충전소 {len(stations)}곳 · 충전기 {len(chargers)}기")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="DB에 씀 (없으면 요약만)")
    sys.exit(main(parser.parse_args().commit))
