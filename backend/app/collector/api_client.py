import logging
import threading
import time
from collections import Counter

import httpx

from app.config import settings

# getChargerInfo - 충전기 정보 + 상태 전체 스냅샷. 상태값은 원천이 약 30분 배치로 갱신됨(2026-10-02 실측)
# getChargerStatus - 최근 period분 안에 상태가 바뀐 충전기만 주는 증분 API. 5분 수집의 주 데이터원
# 경위는 docs/decisions.md "실시간 상태 수집 API" 참고
BASE_URL = "https://apis.data.go.kr/B552584/EvCharger"
INFO_URL = f"{BASE_URL}/getChargerInfo"
STATUS_URL = f"{BASE_URL}/getChargerStatus"
# 2026-10-23부터 getChargerStatus 응답이 10초를 넘는 회차가 약 30% (11/1까지 ReadTimeout 1,582건) -
# 수집 주기(5분)에 비해 짧아 30초로 늘림. 페이지마다 적용되며, Status · Info가 둘 다 재시도까지 기다려도 2분 안에 끝남
REQUEST_TIMEOUT_SEC = 30
# 타임아웃 · 504만 1회 재시도함 - 11/1~11/9 실패가 이 둘뿐이고(Status 실패율 16.5%) 둘 다 응답 30초 언저리의
# 같은 현상(게이트웨이 한도와 타임아웃의 경합)이라 바로 다시 부르면 통하는 경우가 있음.
# 그 외 4xx · 5xx · 연결 오류는 다시 불러도 같은 결과라 재시도하지 않음.
# 하루 한도는 운영계정(2026-11-15 승인) 기준 기능별 100,000건 - 정상 호출은 마포 · 천안 672건 + 서울 672건이라 여유가 큼.
# 재시도 횟수는 호출부가 정함: 마포 · 천안은 1회(아래 기본값, 11/10 결정 그대로), 서울 Info는 페이지당 2회
MAX_RETRIES = 1

logger = logging.getLogger(__name__)

# 하루 요약 알림용 재시도 횟수 (INF-09) - (조회 지역 zscode · zcode, "retried" · "recovered") → 횟수.
# 조회 지역 코드는 collection_runs.zscode와 같은 값이라 요약이 회차 기록과 이 코드로 맞춤.
# 지금 수집 잡 셋(11440 · 44130 · 11)은 코드가 모두 달라 섞이지 않음 - 같은 코드로 잡을 하나 더 만들면 키에 target을 넣어야 함
# retried: 다시 부른 횟수, recovered: 다시 불러 성공한 호출 수. 프로세스 메모리라 collector 재시작 때 0부터.
# 수집 잡이 스레드마다 돌아서 잠금을 씀
_retry_stats: Counter = Counter()
_retry_lock = threading.Lock()


def _count_retry(area: str, kind: str) -> None:
    with _retry_lock:
        _retry_stats[(area, kind)] += 1


def take_retry_stats() -> Counter:
    """지금까지 센 재시도 횟수를 돌려주고 0으로 되돌림 - 하루 요약이 부름"""
    global _retry_stats
    with _retry_lock:
        stats, _retry_stats = _retry_stats, Counter()
    return stats


def put_back_retry_stats(stats: Counter) -> None:
    """하루 요약을 못 보냈을 때 가져간 횟수를 되돌려 다음 요약에 합침"""
    with _retry_lock:
        _retry_stats.update(stats)


def _is_retryable(e: httpx.HTTPError) -> bool:
    if isinstance(e, httpx.TimeoutException):
        return True
    return isinstance(e, httpx.HTTPStatusError) and e.response.status_code == 504


def _describe(e: httpx.HTTPError) -> str:
    # 요청 URL(serviceKey 포함)이 든 예외 메시지는 쓰지 않고 상태 코드 · 예외 이름만 남김
    if isinstance(e, httpx.HTTPStatusError):
        return f"HTTP {e.response.status_code}"
    return f"요청 실패: {type(e).__name__}"


def _fetch_items(
    url: str, params: dict, max_retries: int = MAX_RETRIES, deadline: float | None = None
) -> list[dict]:
    params = {
        "serviceKey": settings.ev_service_key.get_secret_value(),
        "dataType": "JSON",
        **params,
    }
    # httpx 예외 메시지에는 serviceKey가 든 요청 URL이 평문으로 들어감 - 호출부의 logger.exception으로
    # 로그에 남지 않도록 원래 예외를 버리고(from None) 엔드포인트 이름 · 상태 코드만 남김
    name = url.rsplit("/", 1)[-1]
    area = str(params.get("zscode") or params.get("zcode") or "")
    for attempt in range(1 + max_retries):
        timeout = REQUEST_TIMEOUT_SEC
        # deadline(time.monotonic 기준)이 있으면 요청 타임아웃을 남은 시간으로 줄임 - 상한 직전에 시작한 요청이 30초를 넘기지 않게
        if deadline is not None:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise RuntimeError(f"{name} 시간 상한 초과")
            timeout = min(timeout, remaining)
        try:
            resp = httpx.get(url, params=params, timeout=timeout)
            resp.raise_for_status()
            if attempt > 0:
                _count_retry(area, "recovered")
            break
        except httpx.HTTPError as e:
            reason = _describe(e)
            if attempt < max_retries and _is_retryable(e):
                logger.warning("%s %s - 재시도 (%d/%d)", name, reason, attempt + 1, max_retries)
                _count_retry(area, "retried")
                continue
            raise RuntimeError(f"{name} {reason}") from None

    data = resp.json()
    items = data.get("items")
    if not items:
        return []

    item = items.get("item")
    if item is None:
        return []
    if isinstance(item, dict):
        return [item]
    return item


def get_charger_info(
    page_no: int = 1,
    num_of_rows: int = 100,
    zcode: str | None = None,
    zscode: str | None = None,
    max_retries: int = MAX_RETRIES,
    deadline: float | None = None,
) -> list[dict]:
    params = {"pageNo": page_no, "numOfRows": num_of_rows}
    if zcode:
        params["zcode"] = zcode
    if zscode:
        params["zscode"] = zscode
    return _fetch_items(INFO_URL, params, max_retries, deadline)


def get_charger_status(
    period: int = 5,
    page_no: int = 1,
    num_of_rows: int = 100,
    zcode: str | None = None,
    zscode: str | None = None,
    max_retries: int = MAX_RETRIES,
    deadline: float | None = None,
) -> list[dict]:
    # period - 상태갱신 조회 범위(분), API 허용 범위 1~10
    # statUpdDt는 상태가 그대로여도 갱신되는 하트비트라 '상태 변경 시각'으로 쓰면 안 됨 - stat 변화로 판단할 것
    params = {"pageNo": page_no, "numOfRows": num_of_rows, "period": period}
    if zcode:
        params["zcode"] = zcode
    if zscode:
        params["zscode"] = zscode
    return _fetch_items(STATUS_URL, params, max_retries, deadline)
