import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.blocking import BlockingScheduler

from app.collector.api_client import get_charger_info
from app.db.models import Charger, ChargerStatusLog
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
# httpx가 INFO에서 요청 URL 전체를 찍어 serviceKey가 평문 노출됨 - 경고 이상만 남김
logging.getLogger("httpx").setLevel(logging.WARNING)

# getChargerStatus는 상태 데이터가 있는 충전소가 극히 일부(전국 등록 대비)라 실사용 불가로 확인됨.
# getChargerInfo 응답 자체에 stat/statUpdDt 등 상태 필드가 실시간으로 들어있어서 이걸로 대체.
PAGE_SIZE = 9999  # 천안 7,295건 - 2000이면 잘림. 광진구 1,492 / 이천 2,292건은 여유

# (주기 분, zscode 목록) - 광진구는 예측·추천 대상이라 5분, 휴게소는 대조군이라 10분.
# 하루 호출 수 = 1콜×288 + 2콜×144 = 576건으로 한도(1,000) 안에 들어감.
JOBS = [
    (5, ["11215"]),  # 광진구 급속 전체
    (10, ["41500", "44130"]),  # 이천 · 천안 휴게소
]

# 공공 API 응답 시각은 KST 기준 - UTC로 변환해 timestamptz에 저장함 (BE-09)
KST = ZoneInfo("Asia/Seoul")


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=KST).astimezone(timezone.utc)


def fetch_info(zscodes: list[str]) -> list[dict]:
    all_items = []
    for zscode in zscodes:
        try:
            page_no = 1
            while True:
                items = get_charger_info(page_no=page_no, num_of_rows=PAGE_SIZE, zscode=zscode)
                if not items:
                    break
                all_items.extend(items)
                if len(items) < PAGE_SIZE:
                    break
                page_no += 1
        except Exception:
            # 한 지역 실패가 같은 잡의 다른 지역까지 막지 않도록 분리함
            logger.exception("지역 %s 조회 실패 - 이번 사이클 건너뜀", zscode)
    return all_items


def collect_status(zscodes: list[str]):
    label = ",".join(zscodes)
    db = SessionLocal()
    try:
        target_ids = {(c.station_id, c.charger_id) for c in db.query(Charger).all()}

        items = fetch_info(zscodes)
        collected_at = datetime.now(timezone.utc)

        saved = 0
        for item in items:
            key = (item.get("statId"), item.get("chgerId"))
            if key not in target_ids:
                continue

            db.add(
                ChargerStatusLog(
                    station_id=item.get("statId"),
                    charger_id=item.get("chgerId"),
                    stat=item.get("stat"),
                    stat_upd_dt=parse_dt(item.get("statUpdDt")),
                    last_charge_start_dt=parse_dt(item.get("lastTsdt")),
                    last_charge_end_dt=parse_dt(item.get("lastTedt")),
                    current_charge_start_dt=parse_dt(item.get("nowTsdt")),
                    collected_at=collected_at,
                )
            )
            saved += 1

        db.commit()
        # target_ids는 전 지역 합계라 잡별 저장 수와 다른 게 정상 - 잡 구분을 위해 zscode를 같이 찍음
        logger.info("수집 완료 [%s] - %d기 저장", label, saved)
    except Exception:
        db.rollback()
        logger.exception("수집 실패 [%s]", label)
    finally:
        db.close()


def main():
    scheduler = BlockingScheduler()
    for minutes, zscodes in JOBS:
        scheduler.add_job(
            collect_status,
            "interval",
            minutes=minutes,
            args=[zscodes],
            next_run_time=datetime.now(),
        )
    scheduler.start()


if __name__ == "__main__":
    main()
