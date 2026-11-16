import argparse
import json
import math
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.collector.api_client import get_charger_info
from app.collector.scheduler import JOBS, PAGE_SIZE
from app.db.models import LiveCharger, LiveStation, LiveStatusLog
from app.db.session import SessionLocal
from app.services.status import BUS_CHARGER_TYPE
from scripts.update_charger_counts import classify

# 서울 실시간 표시 대상(live_stations · live_chargers)을 처음 채움. 서울 Info 전체(약 8페이지)를 한 번 받음.
# 대상: 삭제 제외 · 50kW 이상 · 이용제한 없음 · 버스형(11) 제외 · 마포(zscode 11440) 제외 - 마포 목록(build_station_list.py)과 같은 기준.
# 여기에 원천 데이터 오류를 뺌(2026-11-16): 이름에 "테스트"가 든 충전소, 좌표가 서울 경계에서 1km 넘게 밖인 충전소.
# 상태 로그는 collector 서울 잡이 첫 회차부터 채움 (대상이 비어 있으면 그 잡은 회차마다 대상 0기로 기록됨).
# 이미 채워져 있으면 멈춤. 페이지가 하나라도 실패하면 DB에 아무것도 쓰지 않음
#
#   python scripts/init_live_chargers.py                    받아서 요약만 (DB에 쓰지 않음)
#   python scripts/init_live_chargers.py --commit           채움
#   python scripts/init_live_chargers.py --prune            이미 채운 대상 중 제외 규칙에 걸리는 충전소 목록
#   python scripts/init_live_chargers.py --prune --commit   그 충전소의 상태 로그 · 충전기 · 충전소를 지움
MAPO_ZSCODE = "11440"
MIN_FAST_KW = 50
# 프론트 지도 서비스 범위(frontend/src/assets/coverage-boundary.json)의 서울 경계선을 복사한 것 - [[lng, lat], ...]
SEOUL_RING = json.loads(Path(__file__).with_name("seoul_boundary.json").read_text())
# 점 수를 줄인 경계라 실제 서울 안인 충전소가 살짝 밖으로 나옴(강동구 복지상일충전소 0.02km) - 이 거리까지는 살림.
# 2026-11-16 좌표 오류 4곳은 6 · 26 · 31 · 33km 밖
OUTSIDE_TOLERANCE_KM = 1.0
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


def _km(lng: float, lat: float) -> tuple[float, float]:
    # 서울 크기에서는 평면 근사로 충분함 (위도 37.55도 기준 경도 1도 ≈ 88km)
    return lng * math.cos(math.radians(37.55)) * 111.32, lat * 110.57


def km_outside_seoul(lng: float, lat: float, ring=SEOUL_RING) -> float:
    """서울 경계 안이면 0, 밖이면 경계선까지 거리(km)"""
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1], strict=True):
        if (y1 > lat) != (y2 > lat) and lng < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    if inside:
        return 0.0
    px, py = _km(lng, lat)
    best = math.inf
    for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
        (ax, ay), (bx, by) = _km(*a), _km(*b)
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
        best = min(best, math.hypot(px - ax - t * dx, py - ay - t * dy))
    return best


def exclusion_reason(name: str | None, lat: float | None, lng: float | None) -> str | None:
    """원천 데이터 오류로 서울 대상에서 뺄 충전소면 이유, 아니면 None.
    운영사가 시험용으로 등록한 충전소(GS000001 '테스트용' 등 - 좌표도 33.0, 125.0)와 좌표가 틀린 충전소
    (KP003057 주소는 구로구 · 좌표는 고양 등). '운전면허시험장'처럼 '시험'은 실제 충전소라 보지 않음"""
    if name and "테스트" in name:
        return "테스트용"
    if lat is None or lng is None:
        return "좌표 없음"
    km = km_outside_seoul(lng, lat)
    if km > OUTSIDE_TOLERANCE_KM:
        return f"서울 밖 좌표 ({km:.1f}km)"
    return None


def prune(commit: bool) -> int:
    """이미 채운 서울 대상에 제외 규칙을 적용. collector는 회차마다 대상을 DB에서 읽어 재시작 없이 다음 회차부터 빠짐"""
    db = SessionLocal()
    try:
        targets = [
            (s, reason)
            for s in db.query(LiveStation).order_by(LiveStation.station_id)
            if (reason := exclusion_reason(s.name, s.lat, s.lng))
        ]
        for s, reason in targets:
            print(f"  {s.station_id} {s.name} | {s.addr} | {s.lat}, {s.lng} → {reason}")
        ids = [s.station_id for s, _ in targets]
        print(f"제외할 충전소 {len(ids)}곳")
        if not ids or not commit:
            if ids:
                print("--commit 없이 실행 - DB에 쓰지 않음")
            return 0
        # FK 순서대로 - 상태 로그 → 충전기 → 충전소. 한 트랜잭션이라 중간에 실패하면 아무것도 안 지워짐
        logs = (
            db.query(LiveStatusLog)
            .filter(LiveStatusLog.station_id.in_(ids))
            .delete(synchronize_session=False)
        )
        chargers = (
            db.query(LiveCharger)
            .filter(LiveCharger.station_id.in_(ids))
            .delete(synchronize_session=False)
        )
        stations = (
            db.query(LiveStation)
            .filter(LiveStation.station_id.in_(ids))
            .delete(synchronize_session=False)
        )
        db.commit()
        print(f"삭제 완료 - 충전소 {stations}곳 · 충전기 {chargers}기 · 상태 로그 {logs}행")
        return 0
    finally:
        db.close()


def main(commit: bool) -> int:
    db = SessionLocal()
    try:
        if db.query(LiveCharger).first() is not None:
            print("live_chargers가 이미 채워져 있음 - 중단")
            return 1

        print(f"서울 Info 받는 중 ({SEOUL_AREA})")
        items = fetch_seoul()
        # 페이지 사이에 데이터가 바뀌어 같은 충전기가 두 번 오면 한 번만 넣음
        fast = {(i["statId"], i["chgerId"]): i for i in items if is_fast_target(i)}
        excluded = {}
        for item in fast.values():
            reason = exclusion_reason(
                item.get("statNm"), to_float(item.get("lat")), to_float(item.get("lng"))
            )
            if reason:
                excluded[item["statId"]] = f"{item.get('statNm')} → {reason}"
        chargers = {key: item for key, item in fast.items() if key[0] not in excluded}
        for sid, text in sorted(excluded.items()):
            print(f"  제외 {sid} {text}")
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
            f" (원천 데이터 오류로 {len(excluded)}곳 제외)"
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
    parser.add_argument(
        "--prune", action="store_true", help="이미 채운 대상에서 제외 규칙에 걸리는 충전소를 지움"
    )
    args = parser.parse_args()
    sys.exit(prune(args.commit) if args.prune else main(args.commit))
