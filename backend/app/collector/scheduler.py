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
COLLECT_ZSCODE = "11215"  # 광진구 - 여기서 바로 필터되니 서울 전체를 받을 필요 없음
PAGE_SIZE = 2000  # 현재 광진구 전체 1,492건, 페이지네이션으로 향후 증가에도 안전하게 대응

# 공공 API 응답 시각은 KST 기준 - UTC로 변환해 timestamptz에 저장함 (BE-09)
KST = ZoneInfo("Asia/Seoul")


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=KST).astimezone(timezone.utc)


def fetch_all_gwangjin_info() -> list[dict]:
    all_items = []
    page_no = 1
    while True:
        items = get_charger_info(page_no=page_no, num_of_rows=PAGE_SIZE, zscode=COLLECT_ZSCODE)
        if not items:
            break
        all_items.extend(items)
        if len(items) < PAGE_SIZE:
            break
        page_no += 1
    return all_items


def collect_status():
    db = SessionLocal()
    try:
        target_ids = {(c.station_id, c.charger_id) for c in db.query(Charger).all()}

        items = fetch_all_gwangjin_info()
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
        logger.info("수집 완료 - 대상 %d개 중 %d개 저장", len(target_ids), saved)
    except Exception:
        db.rollback()
        logger.exception("수집 실패")
    finally:
        db.close()


def main():
    scheduler = BlockingScheduler()
    scheduler.add_job(collect_status, "interval", minutes=5, next_run_time=datetime.now())
    scheduler.start()


if __name__ == "__main__":
    main()
