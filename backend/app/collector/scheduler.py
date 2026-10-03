import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.blocking import BlockingScheduler

from app.collector.api_client import get_charger_info, get_charger_status
from app.db.models import CityCharger, CityStatusLog, ServiceAreaCharger, ServiceAreaStatusLog
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
# httpx가 INFO에서 요청 URL 전체를 찍어 serviceKey가 평문 노출됨 - 경고 이상만 남김
logging.getLogger("httpx").setLevel(logging.WARNING)

# 5분마다 getChargerStatus(최근 변화분)로 상태를 갱신하고, 30분마다 getChargerInfo(전체 스냅샷)로 놓친 변화를 보정함.
# getChargerInfo 상태값은 원천이 약 30분 배치라 그것만 5분마다 부르면 같은 값이 6번 반복 저장됨 (2026-10-02 실측)
PAGE_SIZE = 9999  # 천안 Info 7,362건 - 2000이면 잘림
CYCLE_MIN = 5
STATUS_PERIOD_MIN = 10  # 수집 주기의 2배 - 한 회차가 실패해도 다음 회차가 그 구간을 덮음 (API 최대 10)
INFO_EVERY_CYCLES = 6  # 5분 × 6 = 30분. 원천이 30분 배치라 더 자주 불러도 새 값이 없음

# (zscode 목록, 충전기 모델, 로그 모델) - 마포구는 예측·추천 대상, 천안 휴게소는 대조군이라 테이블이 분리돼 있음.
# 하루 호출 수 = Status 2콜×288 + Info 2콜×48 = 672건으로 한도(1,000) 안에 들어감.
JOBS = [
    (["11440"], CityCharger, CityStatusLog),  # 마포구 급속 전체
    (["44130"], ServiceAreaCharger, ServiceAreaStatusLog),  # 천안 휴게소
]

# 공공 API 응답 시각은 KST 기준 - UTC로 변환해 timestamptz에 저장함 (BE-09)
KST = ZoneInfo("Asia/Seoul")


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=KST).astimezone(timezone.utc)


def fetch_all(fetch, zscode: str, **params) -> list[dict]:
    all_items = []
    page_no = 1
    while True:
        items = fetch(page_no=page_no, num_of_rows=PAGE_SIZE, zscode=zscode, **params)
        all_items.extend(items)
        if len(items) < PAGE_SIZE:
            return all_items
        page_no += 1


class RegionCollector:
    """한 지역(테이블 쌍)의 대상 충전기 현재 상태를 메모리에 들고 5분마다 스냅샷으로 저장함"""

    def __init__(self, zscodes: list[str], charger_model, log_model):
        self.zscodes = zscodes
        self.charger_model = charger_model
        self.log_model = log_model
        self.label = ",".join(zscodes)
        self.state: dict[tuple[str, str], dict] = {}  # (station_id, charger_id) -> 로그 컬럼 값
        self.loaded = False
        self.cycles_until_info = 0  # 0이면 이번 회차에 Info 호출 - 시작 직후 1회 + 실패 시 다음 회차 재시도

    def load_last_rows(self, db):
        # 재시작 직후 Info(최대 30분 지연)로만 채우면 다음 배치까지 틀린 상태가 저장됨 - DB 마지막 행부터 채움
        log = self.log_model
        rows = (
            db.query(log)
            .distinct(log.station_id, log.charger_id)
            .order_by(log.station_id, log.charger_id, log.collected_at.desc())
            .all()
        )
        for r in rows:
            self.state[(r.station_id, r.charger_id)] = {
                "stat": r.stat,
                "stat_upd_dt": r.stat_upd_dt,
                "last_charge_start_dt": r.last_charge_start_dt,
                "last_charge_end_dt": r.last_charge_end_dt,
                "current_charge_start_dt": r.current_charge_start_dt,
            }
        logger.info("DB 마지막 상태 불러옴 [%s] - %d기", self.label, len(rows))

    def apply(self, item: dict, targets: set) -> bool:
        """더 최신 값이면 반영함. stat이 바뀌었으면 True"""
        key = (item.get("statId"), item.get("chgerId"))
        if key not in targets:
            return False
        upd = parse_dt(item.get("statUpdDt"))
        cur = self.state.get(key)
        # 이미 반영한 것보다 오래된 값은 버림 - 30분 늦은 Info가 Status로 받은 최신 상태를 덮지 않게 함
        if cur and cur["stat_upd_dt"] and (upd is None or upd < cur["stat_upd_dt"]):
            return False
        # statUpdDt는 운영사에 따라 하트비트(상태가 그대로여도 갱신)라 기존 데이터와 같게 받은 값 그대로 저장함
        self.state[key] = {
            "stat": item.get("stat"),
            "stat_upd_dt": upd,
            "last_charge_start_dt": parse_dt(item.get("lastTsdt")),
            "last_charge_end_dt": parse_dt(item.get("lastTedt")),
            "current_charge_start_dt": parse_dt(item.get("nowTsdt")),
        }
        return cur is None or cur["stat"] != item.get("stat")

    def fetch_and_apply(self, fetch, targets: set, **params) -> tuple[int, bool]:
        changed, ok = 0, True
        for zscode in self.zscodes:
            try:
                items = fetch_all(fetch, zscode, **params)
            except Exception:
                # 한 지역 실패가 같은 잡의 다른 지역까지 막지 않도록 분리함
                logger.exception("%s 조회 실패 [%s] - 이번 사이클 건너뜀", fetch.__name__, zscode)
                ok = False
                continue
            changed += sum(self.apply(item, targets) for item in items)
        return changed, ok

    def collect(self):
        db = SessionLocal()
        try:
            if not self.loaded:
                self.load_last_rows(db)
                self.loaded = True
            targets = {(c.station_id, c.charger_id) for c in db.query(self.charger_model).all()}

            # Status를 먼저 반영해야 Info 변화 수가 'Status가 놓쳐서 Info로 보정된 건수'만 셈
            status_changed, _ = self.fetch_and_apply(get_charger_status, targets, period=STATUS_PERIOD_MIN)

            info_changed = 0
            if self.cycles_until_info <= 0:
                info_changed, ok = self.fetch_and_apply(get_charger_info, targets)
                if ok:
                    self.cycles_until_info = INFO_EVERY_CYCLES
            self.cycles_until_info -= 1

            collected_at = datetime.now(timezone.utc)
            saved = 0
            for station_id, charger_id in targets:
                values = self.state.get((station_id, charger_id))
                if values is None:
                    continue
                db.add(self.log_model(station_id=station_id, charger_id=charger_id, collected_at=collected_at, **values))
                saved += 1

            db.commit()
            logger.info(
                "수집 완료 [%s] - %d기 저장 (상태 변화: Status %d · Info %d)",
                self.label, saved, status_changed, info_changed,
            )
        except Exception:
            db.rollback()
            logger.exception("수집 실패 [%s]", self.label)
        finally:
            db.close()


def main():
    scheduler = BlockingScheduler()
    for zscodes, charger_model, log_model in JOBS:
        collector = RegionCollector(zscodes, charger_model, log_model)
        scheduler.add_job(collector.collect, "interval", minutes=CYCLE_MIN, next_run_time=datetime.now())
    scheduler.start()


if __name__ == "__main__":
    main()
