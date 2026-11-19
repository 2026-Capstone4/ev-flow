"""체크포인트 producer - collector가 커밋한 도심 회차마다 AI 패키지의 maintain_checkpoint.py를 새 프로세스로 실행 (D2)

- POST /runs/{run_id}: 갱신 + PostgreSQL 게시. 종료 코드 0 + 같은 run의 atomic_publish · duplicate_noop이면 200
- GET /healthz
- 단일 스레드 서버라 요청이 하나씩 처리됨 - 같은 상태 볼륨 작업이 겹치지 않음 (패키지의 OS 잠금은 그대로 둠)
- 최초 구축 · 재구축(--initialize)은 여기서 하지 않음 - 운영자가 compose run으로 실행 (docs/prediction.md)
- 표준 라이브러리만 씀. 패키지 코드는 서버 ml/package/를 /package에 읽기 전용으로 마운트
"""

import json
import logging
import os
import re
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("producer")

PORT = int(os.environ.get("PRODUCER_PORT", "8002"))
PACKAGE_DIR = Path(os.environ.get("EVFLOW_PACKAGE_DIR", "/package"))
STATE_DIR = Path(os.environ.get("EVFLOW_CHECKPOINT_DIR", "/state/evflow"))
# 증분 실측 약 2초 - 넘으면 하위 프로세스를 끝내 OS 잠금을 풂. collector는 60초만 기다리고 다음 회차로 넘어감
TIMEOUT_SEC = 100

BUSY = "checkpoint_producer_busy_retry_same_run"
PUBLISHED = {"atomic_publish", "duplicate_noop"}
# revision 상승(#89 hook) · 원천 정정 뒤에는 증분이 거부됨 - --initialize 재구축이 필요하다고 로그로 알림
REBUILD_HINTS = (
    "_reinitialize",
    "_requires_rebuild",
    "checkpoint_incompatible_",
    "checkpoint_missing_run_initialize_first",
)
ROUTE = re.compile(r"^/runs/([1-9]\d{0,18})$")


def last_json(stdout: str) -> dict:
    """패키지는 결과를 JSON 한 줄로 찍음 (비밀값 · DSN은 빼고) - 마지막 JSON 줄만 씀"""
    for line in reversed(stdout.splitlines()):
        try:
            value = json.loads(line)
        except ValueError:
            continue
        if isinstance(value, dict):
            return value
    return {}


def run_producer(run_id: int) -> tuple[int, dict]:
    if not (STATE_DIR / "latest.json").exists():
        return 503, {"status": "ERROR", "reason": "checkpoint_not_initialized"}
    command = [
        sys.executable,
        "-B",
        str(PACKAGE_DIR / "maintain_checkpoint.py"),
        "--run-id",
        str(run_id),
        "--publish-postgres",
        "--checkpoint-dir",
        str(STATE_DIR),
    ]
    try:
        proc = subprocess.run(
            command, cwd=PACKAGE_DIR, capture_output=True, text=True, timeout=TIMEOUT_SEC
        )
    except subprocess.TimeoutExpired:
        return 504, {"status": "ERROR", "reason": "producer_timeout"}

    result = last_json(proc.stdout)
    publication = result.get("publication") or {}
    if (
        proc.returncode == 0
        and result.get("run_id") == run_id
        and publication.get("kind") in PUBLISHED
    ):
        return 200, {
            "status": "OK",
            "run_id": run_id,
            "maintenance": result.get("kind"),  # incremental · duplicate_noop
            "publication": publication["kind"],
            "seconds": round(result.get("seconds", 0) + publication.get("publish_seconds", 0), 3),
        }
    if not result:
        # JSON이 없으면 import 오류 등으로 패키지가 비정상 종료한 것 - stderr 끝부분만 남김
        logger.error("producer 비정상 종료 (exit %s) - %s", proc.returncode, proc.stderr[-500:])
    reason = result.get("reason")
    if reason == BUSY:
        return 409, {"status": "BUSY", "reason": reason}
    if reason and any(hint in reason for hint in REBUILD_HINTS):
        logger.warning("체크포인트 재구축 필요 (%s) - compose run으로 --initialize 실행", reason)
        return 503, {"status": "ERROR", "reason": reason, "rebuild_required": True}
    return 500, {
        "status": "ERROR",
        "error_type": result.get("error_type"),
        "reason": reason,
        "exit_code": proc.returncode,
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: dict) -> None:
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/healthz":
            self._send(200, {"status": "OK", "initialized": (STATE_DIR / "latest.json").exists()})
        else:
            self._send(404, {"status": "ERROR", "reason": "not_found"})

    def do_POST(self):
        match = ROUTE.match(self.path)
        if not match:
            self._send(404, {"status": "ERROR", "reason": "not_found"})
            return
        run_id = int(match.group(1))
        code, body = run_producer(run_id)
        logger.info("run %d → %d %s", run_id, code, body.get("publication") or body.get("reason"))
        self._send(code, body)

    def log_message(self, format, *args):  # 기본 접근 로그는 끔 - 결과 로그를 위에서 한 줄로 남김
        pass


if __name__ == "__main__":
    logger.info("producer 시작 - port %d, package %s, state %s", PORT, PACKAGE_DIR, STATE_DIR)
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
