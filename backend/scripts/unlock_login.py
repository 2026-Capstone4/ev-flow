import argparse
import sys
from pathlib import Path

import redis

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings

# 로그인 잠금 · 실패 기록 삭제 - 시연 중이나 실수로 잠겼을 때 15분을 기다리지 않고 바로 풀기
#   전부 풀기:      python scripts/unlock_login.py          (아이디 · IP 기록 모두)
#   아이디만 풀기:  python scripts/unlock_login.py <login_id>   (IP 잠금은 그대로)
#   서버에서는:     docker compose exec api python scripts/unlock_login.py


def main() -> None:
    parser = argparse.ArgumentParser(description="로그인 잠금 · 실패 기록 삭제")
    parser.add_argument("login_id", nargs="?", help="이 아이디의 기록만 지움 - 없으면 전부")
    args = parser.parse_args()

    r = redis.Redis.from_url(settings.redis_url)
    if args.login_id:
        keys = [f"login_fail:id:{args.login_id}", f"login_lock:id:{args.login_id}"]
    else:
        keys = [*r.scan_iter("login_fail:*"), *r.scan_iter("login_lock:*")]
    deleted = r.delete(*keys) if keys else 0
    print(f"로그인 잠금 · 실패 기록 {deleted}건 삭제")


if __name__ == "__main__":
    main()
