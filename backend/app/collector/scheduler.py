import logging
import time
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.blocking import BlockingScheduler
from sqlalchemy import text, update

from app.collector import alerts
from app.collector.alerts import check_collection_health, notify_failed_run, send_daily_summary
from app.collector.api_client import MAX_RETRIES, get_charger_info, get_charger_status
from app.collector.baseline import ensure_baseline, refresh_baseline
from app.collector.checkpoint import publish_checkpoint
from app.collector.prediction import refresh_predictions
from app.db.models import (
    CityCharger,
    CityStatusLog,
    CollectionRun,
    LiveCharger,
    LiveStatusLog,
    ServiceAreaCharger,
    ServiceAreaStatusLog,
)
from app.db.session import SessionLocal
from app.services.status import BUS_CHARGER_TYPE

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
# httpx가 INFO에서 요청 URL 전체를 찍어 serviceKey가 평문 노출됨 - 경고 이상만 남김
logging.getLogger("httpx").setLevel(logging.WARNING)

# 5분마다 getChargerStatus(최근 변화분)로 상태를 갱신하고, 30분마다 getChargerInfo(전체 스냅샷)로 놓친 변화를 보정함.
# getChargerInfo 상태값은 원천이 약 30분 배치라 그것만 5분마다 부르면 같은 값이 6번 반복 저장됨 (2026-10-02 실측)
PAGE_SIZE = 9999  # 천안 Info 7,362건 - 2000이면 잘림
CYCLE_MIN = 5
STATUS_PERIOD_MIN = (
    10  # 수집 주기의 2배 - 한 회차가 실패해도 다음 회차가 그 구간을 덮음 (API 최대 10)
)
INFO_EVERY_CYCLES = 6  # 5분 × 6 = 30분. 원천이 30분 배치라 더 자주 불러도 새 값이 없음

# (조회 지역, 충전기 모델, 로그 모델, 옵션) - 마포구는 예측·추천 대상, 천안 휴게소는 대조군, 서울은 화면 표시용이라 테이블이 분리돼 있음.
# 지역마다 잡 하나 - Status 호출이 실패하면 그 잡의 회차 전체를 결측으로 기록함
# 하루 호출 수 = 마포 · 천안 672건 + 서울 Status 288 · Info 약 8콜×48 ≈ 672건 - 운영계정 한도는 기능별 100,000건.
# 마포는 서울 Status(zcode=11)로 함께 받을 수 있지만 따로 부름 - 회차 기록 · 학습 데이터 형식을 흔들지 않기 위함
JOBS = [
    ({"zscode": "11440"}, CityCharger, CityStatusLog, {}),  # 마포구 급속 (버스전용 제외)
    ({"zscode": "44130"}, ServiceAreaCharger, ServiceAreaStatusLog, {}),  # 천안 휴게소
    # 서울(마포 · 버스형 제외) - 서울 전체를 받아 live_chargers에 있는 대상만 반영. 화면 표시용, 예측 안 함.
    # Info가 약 8페이지라 페이지당 재시도 2회(콜당 타임아웃 약 16%, 11/15 실측) · 전체 3분 상한 - Status와 합쳐 5분 안에 끝남
    ({"zcode": "11"}, LiveCharger, LiveStatusLog, {"info_retries": 2, "info_deadline_sec": 180}),
]

# 공공 API 응답 시각은 KST 기준 - UTC로 변환해 timestamptz에 저장함 (BE-09)
KST = ZoneInfo("Asia/Seoul")


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=KST).astimezone(UTC)


def collection_targets(chargers) -> set[tuple[str, str]]:
    # 버스전용(chgerType 11)은 수집하지 않음 (2026-11-16 - 10/25 "수집은 유지" 결정을 바꿈).
    # 충전기 행 · 지난 로그는 AI 이력 · FK 때문에 남김. 조회 API 조건(charger_type <> '11')과 같게 타입 없는 충전기도 뺌
    return {
        (c.station_id, c.charger_id)
        for c in chargers
        if c.charger_type is not None and c.charger_type != BUS_CHARGER_TYPE
    }


def fetch_all(fetch, area: dict, **params) -> list[dict]:
    all_items = []
    page_no = 1
    while True:
        items = fetch(page_no=page_no, num_of_rows=PAGE_SIZE, **area, **params)
        all_items.extend(items)
        if len(items) < PAGE_SIZE:
            return all_items
        page_no += 1


class RegionCollector:
    """한 지역(테이블 쌍)의 대상 충전기 현재 상태를 메모리에 들고 5분마다 스냅샷으로 저장함"""

    def __init__(
        self,
        area: dict,  # {"zscode": "11440"} 또는 {"zcode": "11"}
        charger_model,
        log_model,
        info_retries: int = MAX_RETRIES,
        info_deadline_sec: float
        | None = None,  # Info 전체 상한 - 없으면 페이지마다 30초 × 재시도만
    ):
        self.area = area
        self.charger_model = charger_model
        self.log_model = log_model
        self.info_retries = info_retries
        self.info_deadline_sec = info_deadline_sec
        self.label = next(iter(area.values()))  # collection_runs.zscode에 남김 (서울은 zcode "11")
        self.target = log_model.__tablename__.removesuffix(
            "_status_log"
        )  # city / service_area / live
        self.state: dict[tuple[str, str], dict] = {}  # (station_id, charger_id) -> 로그 컬럼 값
        self.loaded = False
        self.cycles_until_info = (
            0  # 0이면 이번 회차에 Info 호출 - 시작 직후 1회 + 실패 시 다음 회차 재시도
        )

    def load_last_rows(self, db):
        # 재시작 직후 Info(최대 30분 지연)로만 채우면 다음 배치까지 틀린 상태가 저장됨 - 마지막 성공 회차의 행부터 채움.
        # 로그 전체에서 충전기별 마지막 행을 찾으면 서울(회차당 3,561행)은 재시작마다 오래 걸려서 회차 id로 읽음.
        # 상태를 한 번 안 충전기는 이후 모든 회차에 저장되므로 마지막 성공 회차가 곧 충전기별 마지막 행
        last_run = (
            db.query(CollectionRun.id)
            .filter(
                CollectionRun.target == self.target,
                CollectionRun.status.in_(("SUCCESS", "PARTIAL")),
            )
            .order_by(CollectionRun.started_at.desc())
            .first()
        )
        log = self.log_model
        rows = db.query(log).filter(log.collection_run_id == last_run.id).all() if last_run else []
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

    def fetch_and_apply(self, fetch, targets: set, **params) -> tuple[int, str | None]:
        """(stat이 바뀐 충전기 수, 실패 내용 - 성공하면 None)"""
        try:
            items = fetch_all(fetch, self.area, **params)
        except Exception as e:
            logger.exception("%s 조회 실패 [%s] - 이번 사이클 건너뜀", fetch.__name__, self.label)
            return 0, f"{fetch.__name__} [{self.label}] {type(e).__name__}: {e}"
        return sum(self.apply(item, targets) for item in items), None

    def start_run(self, db, expected_count: int) -> CollectionRun:
        # 바로 커밋해 둠 - 수집 도중 프로세스가 죽어도 기록이 남음 (ADM-003). 남은 RUNNING은 다음 시작 때 FAILED로 정리
        run = CollectionRun(
            target=self.target,
            zscode=self.label,
            started_at=datetime.now(UTC),
            status="RUNNING",
            expected_count=expected_count,
            # 대상에서 버스를 빼서 서비스 대상 수와 같음 - 버스가 섞인 과거 회차와 같은 기준으로
            # 결측 현황(ADM-004)을 집계하려고 eligible 컬럼도 계속 채움
            eligible_expected_count=expected_count,
        )
        db.add(run)
        db.commit()
        return run

    @staticmethod
    def finish_run(
        run: CollectionRun, status: str, matched_count: int = 0, error: str | None = None
    ):
        run.status = status
        run.finished_at = datetime.now(UTC)
        run.matched_count = matched_count
        run.eligible_matched_count = matched_count
        run.error_message = error

    def collect(self):
        db = SessionLocal()
        run = None
        try:
            if not self.loaded:
                self.load_last_rows(db)
                self.loaded = True
            targets = collection_targets(db.query(self.charger_model).all())
            run = self.start_run(db, len(targets))

            # Status를 먼저 반영해야 Info 변화 수가 'Status가 놓쳐서 Info로 보정된 건수'만 셈
            started = time.monotonic()
            status_changed, status_error = self.fetch_and_apply(
                get_charger_status, targets, period=STATUS_PERIOD_MIN
            )
            run.api_latency_ms = round((time.monotonic() - started) * 1000)
            if status_error:
                # 직전 상태를 새 시각으로 저장하면 실패 구간이 '상태 유지'로 보임 - 상태 로그 없이 결측으로만 남김.
                # 다음 회차의 period=10이 이 구간 변화를 덮고, Info 보정도 다음 회차로 미룸 (UC-S01 E1 · ECR-004)
                self.finish_run(run, "FAILED", error=status_error)
                db.commit()
                logger.warning(
                    "수집 결측 [%s] - getChargerStatus 실패로 상태 로그 저장 안 함 (run %d)",
                    self.label,
                    run.id,
                )
                notify_failed_run(run, status_error)
                return

            info_changed = 0
            info_error = None
            if self.cycles_until_info <= 0:
                deadline = (
                    time.monotonic() + self.info_deadline_sec if self.info_deadline_sec else None
                )
                info_changed, info_error = self.fetch_and_apply(
                    get_charger_info, targets, max_retries=self.info_retries, deadline=deadline
                )
                if info_error is None:
                    self.cycles_until_info = INFO_EVERY_CYCLES
            self.cycles_until_info -= 1

            collected_at = datetime.now(UTC)
            saved = 0
            for station_id, charger_id in targets:
                values = self.state.get((station_id, charger_id))
                if values is None:
                    continue
                # Status(period=10)는 바뀐 충전기만 주므로 응답에 없는 충전기는 '변화 없음' - 직전 상태를 이어 씀
                db.add(
                    self.log_model(
                        station_id=station_id,
                        charger_id=charger_id,
                        collected_at=collected_at,
                        collection_run_id=run.id,
                        **values,
                    )
                )
                saved += 1

            # Info 보정 실패 · 상태를 모르는 충전기(UC-S01 2a)는 저장은 하되 PARTIAL로 남김
            ok = info_error is None and saved == len(targets)
            self.finish_run(run, "SUCCESS" if ok else "PARTIAL", saved, info_error)
            # 상태 로그와 실행 결과를 한 트랜잭션으로 커밋 - SUCCESS인데 로그가 없는 경우가 생기지 않게 함
            db.commit()
            logger.info(
                "수집 완료 [%s] - %d/%d기 저장 (상태 변화: Status %d · Info %d)",
                self.label,
                saved,
                len(targets),
                status_changed,
                info_changed,
            )
            # 도심만 예측함 (휴게소는 대조군 - DATA-003). 커밋 뒤에 불러야 예측 실패가 수집 기록에 섞이지 않음.
            # refresh_predictions는 예외를 밖으로 내지 않음 - 아래 except가 이 회차를 FAILED로 바꾸면 안 됨
            if self.target == "city":
                # 체크포인트를 먼저 게시해야 같은 회차 예측에 대기시간이 들어감 - 예외를 밖으로 내지 않음
                publish_checkpoint(run)
                refresh_predictions(db, run)
                # redis를 다시 만들어 키가 사라졌으면 다음 04:00까지 기다리지 않고 바로 채움 - 예외를 밖으로 내지 않음
                ensure_baseline()
        except Exception as e:
            db.rollback()
            logger.exception("수집 실패 [%s]", self.label)
            # 상태 로그는 롤백됐어도 실패 기록은 따로 커밋함 (ADM-003)
            if run is not None:
                try:
                    self.finish_run(run, "FAILED", error=f"{type(e).__name__}: {e}"[:1000])
                    db.commit()
                    # 알림에는 예외 종류만 - DB 오류 메시지에는 접속 정보가 섞일 수 있음
                    notify_failed_run(run, f"{type(e).__name__} (자세한 내용은 collector 로그)")
                except Exception:
                    db.rollback()
                    # run.id를 읽으면 DB를 다시 조회하므로 로그에 넣지 않음 - DB 장애 중이면 여기서 또 실패함
                    logger.exception(
                        "수집 실행 기록 실패 [%s] - 이번 실행은 RUNNING으로 남음 (재시작 때 FAILED로 정리)",
                        self.label,
                    )
        finally:
            db.close()


# 시작 시점의 RUNNING은 이전 프로세스가 끝내지 못한 회차임 - collector는 컨테이너 하나 · 프로세스 하나이고,
# 재시작(deploy.sh --with-collector)은 기존 컨테이너를 멈춘 뒤 새로 띄우므로 이 시점에 진행 중인 회차는 없음.
# 상태 로그는 회차 결과와 한 트랜잭션으로 커밋하므로 끝나지 않은 회차에는 로그가 없음 → 로그 없는 FAILED와 같음.
# 남겨 두면 결측 집계 · ML 실패 회차 목록에서 빠져 설명 없는 빈 구간이 됨. 끝난 시각은 모르므로 finished_at은 비워 둠
ORPHANED_RUN_ERROR = "수집 중단 - 회차를 끝내기 전에 수집기가 멈춤 (재시작 시 정리, 상태 로그 없음)"

# 도심 회차를 RUNNING → FAILED로 바꾸면 ml 체크포인트가 이어받은 과거 근거(실패 회차)가 바뀜 →
# 같은 트랜잭션에서 invalidate_history를 호출해 revision을 올리고 체크포인트를 전부 무효로 함 (AI v3.1 회신 D1).
# 게시된 경계와 비교하지 않고 실제로 바뀐 행이 있으면 항상 호출 - 최초 구축 중인 체크포인트도 놓치지 않게.
# ml_read는 도심만 보므로 휴게소 · 서울 회차만 정리됐으면 호출하지 않음
CHECKPOINT_TARGET = "city"
INVALIDATE_HISTORY_FN = "ml_checkpoint.invalidate_history(timestamptz,text)"
ORPHANED_RUN_HISTORY_REASON = "collector 재시작 시 수집 중단 회차 정리 (#89)"


def close_orphaned_runs(db) -> int:
    closed = db.execute(
        update(CollectionRun)
        .where(CollectionRun.status == "RUNNING")
        .values(
            status="FAILED",
            matched_count=0,
            eligible_matched_count=0,
            error_message=ORPHANED_RUN_ERROR,
        )
        .returning(CollectionRun.target, CollectionRun.started_at)
    ).all()
    city_starts = [started_at for target, started_at in closed if target == CHECKPOINT_TARGET]
    # 함수가 없으면(마이그레이션 7c5eec7b9ab4 전 · 로컬 DB) 무효로 할 체크포인트도 없으므로 건너뜀
    if (
        city_starts
        and db.execute(
            text("SELECT to_regprocedure(:fn) IS NOT NULL"), {"fn": INVALIDATE_HISTORY_FN}
        ).scalar()
    ):
        revision = db.execute(
            text("SELECT ml_checkpoint.invalidate_history(:changed_from, :reason)"),
            {"changed_from": min(city_starts), "reason": ORPHANED_RUN_HISTORY_REASON},
        ).scalar()
        logger.warning("ml 체크포인트 무효화 - revision %s로 올림, 재구축 필요", revision)
    db.commit()
    return len(closed)


def main():
    # 정리에 실패해도 수집은 시작함 - DB가 잠깐 안 되는 경우 재시작을 반복하지 않게
    try:
        with SessionLocal() as db:
            closed = close_orphaned_runs(db)
        if closed:
            logger.warning("끝나지 않은 회차 %d건을 FAILED로 정리함", closed)
    except Exception:
        logger.exception("끝나지 않은 회차 정리 실패 - 수집은 계속함")

    scheduler = BlockingScheduler()
    for area, charger_model, log_model, options in JOBS:
        collector = RegionCollector(area, charger_model, log_model, **options)
        scheduler.add_job(
            collector.collect, "interval", minutes=CYCLE_MIN, next_run_time=datetime.now()
        )
    # 요일 · 시간대 기준선 - 시작 시 1회 + 매일 04:00 KST (이용이 가장 적은 시간, DB 백업 04:30 전에 끝남)
    scheduler.add_job(
        refresh_baseline, "cron", hour=4, minute=0, timezone=KST, next_run_time=datetime.now()
    )
    # 운영 알림 (INF-09) - 수집과 따로 5분마다 회차 기록을 봄. 수집 잡이 멈춰도 검사는 돎.
    # 첫 검사는 시작 6분 뒤 - 배포 · 재시작으로 비었던 구간에 첫 회차가 쌓일 틈을 줌.
    # 실패 회차 알림은 collect 안에서 바로 보냄
    if alerts.is_enabled():
        scheduler.add_job(
            check_collection_health,
            "interval",
            minutes=CYCLE_MIN,
            next_run_time=datetime.now() + timedelta(minutes=CYCLE_MIN + 1),
        )
        # 하루 요약 - 아침에 지난 24시간을 한 번에 봄
        scheduler.add_job(send_daily_summary, "cron", hour=9, minute=0, timezone=KST)
    else:
        logger.info("운영 알림 꺼짐 - .env DISCORD_WEBHOOK_URL 없음")
    scheduler.start()


if __name__ == "__main__":
    main()
