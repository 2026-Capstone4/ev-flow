"""운영 알림 (INF-09) - 수집이 멈추면 Discord Webhook으로 알림 (2026-11-23 결정)

- 조건: 지역별로 최근 끝난 3회차가 모두 FAILED이거나, 마지막 성공 회차가 15분 넘게 없음
  (수집 잡이 멈춰 회차가 아예 안 생기는 경우도 두 번째 조건으로 잡힘)
- 문제가 생길 때 1번, 풀릴 때 1번(복구) 보냄 - 같은 문제로 5분마다 다시 보내지 않음.
  보낸 상태는 프로세스 메모리에만 둠 (재시작하면 아직 문제인 지역은 한 번 더 보냄)
- .env DISCORD_WEBHOOK_URL이 비어 있으면 아무것도 하지 않음 (로컬 · CI)
- collector 자체가 죽으면 이 검사도 멈춤 - 컨테이너는 restart: unless-stopped로 다시 뜸
"""

import logging
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import func

from app.config import settings
from app.db.models import CollectionRun
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

FAILED_STREAK = 3
STALE_MINUTES = 15
TIMEOUT_SEC = 5
KST = ZoneInfo("Asia/Seoul")
# collection_runs.target → 알림에 쓰는 이름
TARGET_NAMES = {"city": "마포 도심", "service_area": "천안 휴게소", "live": "서울 실시간"}
# 수집 기록을 못 읽었을 때 - 지역과 같은 방식으로 한 번 알리고 복구 때 한 번 알림
CHECK_KEY = "check"
CHECK_NAME = "수집 상태 확인"

_alerted: set[str] = set()  # 알림을 보냈고 아직 복구 알림을 안 보낸 지역


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
    if not settings.discord_webhook_url.get_secret_value():
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
