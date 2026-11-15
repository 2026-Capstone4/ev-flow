import argparse
import getpass
import sys
from pathlib import Path

from argon2 import PasswordHasher
from sqlalchemy import func, select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.models import AdminUser
from app.db.session import SessionLocal

# 운영자 계정 생성 · 비밀번호 변경 - 관리자 화면에 가입 · 변경 기능이 없어 계정은 이 스크립트로만 다룸 (SER-001)
# 비밀번호는 인자로 받지 않고 터미널에서 입력받음 - 셸 기록 · 프로세스 목록에 남지 않게 함
#   새 계정:       python scripts/create_admin.py <login_id> --name <이름>
#   비밀번호 변경: python scripts/create_admin.py <login_id>   (기존 로그인은 전부 끊김)
#   서버에서는:    docker compose exec api python scripts/create_admin.py ...
# 해시는 argon2id, 설정은 argon2-cffi 기본값(RFC 9106 저메모리 권장: 64MiB · 3회 · 병렬 4)
# - OWASP 최소(19MiB · 2회 · 병렬 1)보다 높음. 로그인 API도 같은 기본값으로 검증해야 함
MAX_LOGIN_ID_LEN = 50  # admin_users.login_id
MAX_NAME_LEN = 50  # admin_users.name
MIN_PASSWORD_LEN = 8


def read_password() -> str:
    password = getpass.getpass("비밀번호: ")
    if len(password) < MIN_PASSWORD_LEN:
        sys.exit(f"비밀번호는 {MIN_PASSWORD_LEN}자 이상이어야 합니다")
    if getpass.getpass("비밀번호 확인: ") != password:
        sys.exit("비밀번호가 일치하지 않습니다")
    return password


def main() -> None:
    parser = argparse.ArgumentParser(description="운영자 계정 생성 · 비밀번호 변경")
    parser.add_argument("login_id")
    parser.add_argument("--name", help="표시 이름 - 새 계정이면 필수, 기존 계정이면 이름도 바꿈")
    args = parser.parse_args()

    if len(args.login_id) > MAX_LOGIN_ID_LEN:
        sys.exit(f"아이디는 {MAX_LOGIN_ID_LEN}자 이하여야 합니다")
    if args.name and len(args.name) > MAX_NAME_LEN:
        sys.exit(f"이름은 {MAX_NAME_LEN}자 이하여야 합니다")

    db = SessionLocal()
    try:
        admin = db.scalar(select(AdminUser).where(AdminUser.login_id == args.login_id))
        if admin is None and not args.name:
            sys.exit("새 계정은 --name이 필요합니다")

        password_hash = PasswordHasher().hash(read_password())

        if admin is None:
            db.add(AdminUser(login_id=args.login_id, name=args.name, password_hash=password_hash))
            action = "생성"
        else:
            admin.password_hash = password_hash
            admin.password_changed_at = func.now()  # 이 시각보다 먼저 발급된 토큰은 거부됨
            if args.name:
                admin.name = args.name
            action = "비밀번호 변경"
        db.commit()
    finally:
        db.close()
    print(f"{args.login_id}: {action} 완료")


if __name__ == "__main__":
    main()
