"""운영 알림 (INF-09) - 수집 이상을 Discord Webhook으로 알림 (2026-11-23 결정)

- 멈춤 알림: 지역별로 최근 끝난 3회차가 모두 FAILED이거나, 마지막 성공 회차가 15분 넘게 없음
  (수집 잡이 멈춰 회차가 아예 안 생기는 경우도 두 번째 조건으로 잡힘)
  문제가 생길 때 1번, 풀릴 때 1번(복구) 보냄 - 같은 문제로 5분마다 다시 보내지 않음.
  보낸 상태는 프로세스 메모리에만 둠 (재시작하면 아직 문제인 지역은 한 번 더 보냄)
- 실패 회차 알림: 재시도까지 실패해 회차가 FAILED로 끝날 때마다 한 번 (그 회차 상태 로그가 빔)
- 하루 요약: 매일 09:00 KST, 지난 24시간 지역별 회차 결과와 공공 API 재시도 횟수
- .env DISCORD_WEBHOOK_URL이 비어 있으면 아무것도 하지 않음 (로컬 · CI)
- collector 자체가 죽으면 이 검사도 멈춤 - 컨테이너는 restart: unless-stopped로 다시 뜸
"""

import logging
from collections import Counter
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import func, select

from app.collector import api_client
from app.config import settings
from app.db.models import CollectionRun
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

FAILED_STREAK = 3
STALE_MINUTES = 15
TIMEOUT_SEC = 5
SUMMARY_HOURS = 24
REASON_MAX = 200  # 실패 알림에 붙이는 원인 길이 상한
KST = ZoneInfo("Asia/Seoul")
# collection_runs.target → 알림에 쓰는 이름
TARGET_NAMES = {"city": "마포구(예측)", "service_area": "전국 휴게소", "live": "서울(마포 제외)"}
# 수집 기록을 못 읽었을 때 - 지역과 같은 방식으로 한 번 알리고 복구 때 한 번 알림
CHECK_KEY = "check"
CHECK_NAME = "수집 상태 확인"

_alerted: set[str] = set()  # 알림을 보냈고 아직 복구 알림을 안 보낸 지역
# 재시도 횟수는 메모리에서 세므로, 요약 기간 중에 재시작했으면 그 뒤 것만 있다고 적음
_started_at = datetime.now(UTC)


def is_enabled() -> bool:
    return bool(settings.discord_webhook_url.get_secret_value())


def find_problems(
    recent: dict[str, list[str]], last_ok: dict[str, datetime | None], now: datetime
) -> dict[str, list[str]]:
    """지역 → 문제 문구. recent: 최근 끝난 회차 상태(새것부터), last_ok: 마지막 성공 회차 시작 시각"""
    problems = {}
    for target in TARGET_NAMES:
        reasons = []
        statuses = recent.get(target, [])[:FAILED_STREAK]
        if len(statuses) == FAILED_STREAK and all(s == "FAILED" for s in statuses):
            reasons.append(f"{FAILED_STREAK}회 연속 수집 실패")
        ok_at = last_ok.get(target)
        if ok_at is None:
            reasons.append("성공한 수집 기록 없음")
        elif now - ok_at >= timedelta(minutes=STALE_MINUTES):
            minutes = int((now - ok_at).total_seconds() // 60)
            reasons.append(f"마지막 성공 {minutes}분 전 ({ok_at.astimezone(KST):%H:%M})")
        if reasons:
            problems[target] = reasons
    return problems


def plan_messages(problems: dict[str, list[str]], alerted: set[str]) -> list[tuple[str, bool, str]]:
    """보낼 메시지 [(지역, 문제 여부, 내용)] - 새로 생긴 문제와 풀린 문제만"""
    messages = []
    for target, reasons in problems.items():
        if target not in alerted:
            name = TARGET_NAMES.get(target, CHECK_NAME)
            messages.append((target, True, f"🚨 [EV-flow] {name} 이상 - {' · '.join(reasons)}"))
    for target in sorted(alerted - problems.keys()):
        name = TARGET_NAMES.get(target, CHECK_NAME)
        messages.append((target, False, f"✅ [EV-flow] {name} 복구"))
    return messages


def send(content: str) -> bool:
    """Discord Webhook으로 보냄 - 실패해도 예외를 내지 않음 (다음 검사 때 다시 보냄)"""
    try:
        resp = httpx.post(
            settings.discord_webhook_url.get_secret_value(),
            json={"content": content},
            timeout=TIMEOUT_SEC,
        )
    except httpx.HTTPError as e:
        # 예외 메시지에 Webhook 주소(비밀값)가 들어갈 수 있어 종류만 남김
        logger.warning("운영 알림 전송 실패 - %s", type(e).__name__)
        return False
    if resp.status_code >= 300:
        logger.warning("운영 알림 전송 실패 - HTTP %d", resp.status_code)
        return False
    return True


def load_runs(db) -> tuple[dict[str, list[str]], dict[str, datetime]]:
    recent = {}
    for target in TARGET_NAMES:
        rows = (
            db.query(CollectionRun.status)
            .filter(CollectionRun.target == target, CollectionRun.status != "RUNNING")
            .order_by(CollectionRun.started_at.desc())
            .limit(FAILED_STREAK)
            .all()
        )
        recent[target] = [r.status for r in rows]
    last_ok = dict(
        db.query(CollectionRun.target, func.max(CollectionRun.started_at))
        .filter(CollectionRun.status.in_(("SUCCESS", "PARTIAL")))
        .group_by(CollectionRun.target)
        .all()
    )
    return recent, last_ok


def check_collection_health() -> None:
    """5분마다 collector 스케줄러가 부름 - 예외를 밖으로 내지 않음"""
    if not is_enabled():
        return
    try:
        with SessionLocal() as db:
            recent, last_ok = load_runs(db)
        problems = find_problems(recent, last_ok, datetime.now(UTC))
    except Exception:
        logger.exception("운영 알림 - 수집 기록을 읽지 못함")
        # 지역별 상태는 모르므로 이미 보낸 지역 알림은 그대로 두고 확인 실패만 알림
        problems = {t: [] for t in _alerted if t != CHECK_KEY}
        problems[CHECK_KEY] = ["수집 기록을 읽지 못함 (DB 오류)"]
    for target, is_problem, content in plan_messages(problems, _alerted):
        if send(content):
            if is_problem:
                _alerted.add(target)
            else:
                _alerted.discard(target)


def notify_failed_run(run: CollectionRun, reason: str) -> None:
    """회차가 FAILED로 끝날 때마다 한 번 - 재시도까지 실패해 그 회차 상태 로그가 빔. 예외를 밖으로 내지 않음

    reason은 수집기가 남긴 실패 내용 (api_client가 키 · URL을 빼고 만든 문구) - 길면 자름
    """
    if not is_enabled():
        return
    try:
        name = TARGET_NAMES.get(run.target, run.target)
        at = run.started_at.astimezone(KST)
        send(f"⚠️ [EV-flow] {name} 수집 실패 (run {run.id}, {at:%H:%M}) - {reason[:REASON_MAX]}")
    except Exception:
        logger.exception("수집 실패 알림 오류")


def run_counts_query(since: datetime):
    return (
        select(CollectionRun.target, CollectionRun.zscode, CollectionRun.status, func.count())
        .where(CollectionRun.started_at >= since, CollectionRun.status != "RUNNING")
        .group_by(CollectionRun.target, CollectionRun.zscode, CollectionRun.status)
    )


def load_run_counts(db, since: datetime) -> dict[tuple[str, str], Counter]:
    """(지역, 조회 지역 코드) → 끝난 회차 상태별 수"""
    rows = db.execute(run_counts_query(since)).all()
    counts: dict[tuple[str, str], Counter] = {}
    for target, zscode, status, n in rows:
        counts.setdefault((target, zscode), Counter())[status] += n
    return counts


def format_summary(
    counts: dict[tuple[str, str], Counter],
    retries: Counter,
    since: datetime,
    now: datetime,
    started_at: datetime,
) -> str:
    """하루 요약 문구. retries: (조회 지역 코드, retried · recovered) → 횟수 (api_client.take_retry_stats)"""
    order = list(TARGET_NAMES)
    lines = [
        f"📊 [EV-flow] 수집 하루 요약 ({since.astimezone(KST):%m/%d %H:%M} ~ {now.astimezone(KST):%m/%d %H:%M})"
    ]
    for target, zscode in sorted(
        counts, key=lambda k: (order.index(k[0]) if k[0] in order else len(order), k)
    ):
        c = counts[(target, zscode)]
        name = TARGET_NAMES.get(target, target)
        lines.append(
            f"- {name}: 회차 {sum(c.values())} · 성공 {c['SUCCESS']} · 일부 {c['PARTIAL']} · 실패 {c['FAILED']}"
            f" | 재시도 {retries[(zscode, 'retried')]} · 재시도로 성공 {retries[(zscode, 'recovered')]}"
        )
    if not counts:
        lines.append("- 끝난 회차 없음")
    if started_at > since:
        lines.append(
            f"(재시도 수는 collector 재시작 {started_at.astimezone(KST):%m/%d %H:%M} 이후분)"
        )
    return "\n".join(lines)


def send_daily_summary() -> None:
    """매일 09:00 KST collector 스케줄러가 부름 - 예외를 밖으로 내지 않음"""
    if not is_enabled():
        return
    now = datetime.now(UTC)
    since = now - timedelta(hours=SUMMARY_HOURS)
    try:
        with SessionLocal() as db:
            counts = load_run_counts(db, since)
    except Exception:
        logger.exception("하루 요약 - 수집 기록을 읽지 못함")
        send("📊 [EV-flow] 수집 하루 요약 - 수집 기록을 읽지 못함 (DB 오류)")
        return
    retries = api_client.take_retry_stats()
    if not send(format_summary(counts, retries, since, now, _started_at)):
        # 못 보낸 재시도 수는 다음 요약에 합침
        api_client.put_back_retry_stats(retries)
