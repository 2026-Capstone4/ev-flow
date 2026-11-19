"""도심 회차 커밋 직후 체크포인트 producer에 갱신 · 게시를 맡김 (docs/prediction.md)

producer가 이 회차까지의 이력 요약을 ml_checkpoint에 게시해야 ml이 대기시간을 계산할 수 있음.
실패는 여기서 모두 삼킴 - 이미 커밋한 수집 결과와 뒤이은 예측 갱신을 막지 않음
"""

import logging
import time

import httpx

from app.config import settings
from app.db.models import CollectionRun

logger = logging.getLogger(__name__)

TIMEOUT_SEC = 60  # 증분 실측 약 2초. producer는 100초에 하위 프로세스를 끊음
BUSY_RETRIES = 2  # 409(다른 작업 중)일 때만 같은 회차를 다시 보냄 - 단일 스레드라 거의 안 생김
BUSY_WAIT_SEC = 5


def publish_checkpoint(run: CollectionRun) -> bool:
    """이 회차의 체크포인트가 게시됐으면(새로 게시 또는 이미 같은 내용) True. 예외를 밖으로 내지 않음"""
    if not settings.producer_url:
        return False
    # 저장한 관측이 없는 회차는 producer가 근거로 쓸 수 없음 (FAILED는 애초에 여기 오지 않음)
    if run.status not in ("SUCCESS", "PARTIAL") or not run.matched_count:
        return False

    url = f"{settings.producer_url.rstrip('/')}/runs/{run.id}"
    for attempt in range(BUSY_RETRIES + 1):
        try:
            resp = httpx.post(url, timeout=TIMEOUT_SEC)
        except httpx.HTTPError as e:
            logger.warning("체크포인트 갱신 요청 실패 [run %d] - %s", run.id, type(e).__name__)
            return False
        if resp.status_code == 409 and attempt < BUSY_RETRIES:
            time.sleep(BUSY_WAIT_SEC)
            continue
        break

    try:
        body = resp.json()
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {}
    if resp.status_code == 200:
        logger.info(
            "체크포인트 게시 [run %d] - %s · %ss",
            run.id,
            body.get("publication"),
            body.get("seconds"),
        )
        return True
    # 503 checkpoint_not_initialized · rebuild_required는 운영자가 --initialize를 실행해야 풀림
    logger.warning(
        "체크포인트 갱신 실패 [run %d] - HTTP %d %s",
        run.id,
        resp.status_code,
        body.get("reason") or body.get("error_type"),
    )
    return False
