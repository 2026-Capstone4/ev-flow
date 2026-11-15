from datetime import UTC, datetime, timedelta

import jwt
import pytest
import redis
from fastapi.testclient import TestClient
from pydantic import SecretStr
from starlette.requests import Request

from app.api.errors import ApiError
from app.api.v1 import auth as auth_api
from app.config import settings
from app.db.models import AdminUser
from app.db.session import get_db
from app.main import app
from app.services import auth

PASSWORD = "correct-horse-1"
TEST_SECRET = "test-secret-" + "x" * 32  # HS256 권장 길이(32바이트) 이상


class FakePipeline:
    def __init__(self, r):
        self.r = r
        self.ops = []

    def __getattr__(self, name):
        return lambda *args, **kwargs: self.ops.append((name, args, kwargs))

    def execute(self):
        return [getattr(self.r, name)(*args, **kwargs) for name, args, kwargs in self.ops]


class FakeRedis:
    """로그인 제한에 쓰는 명령만 흉내 냄 - TTL은 줄어들지 않고 설정값 그대로 남음"""

    def __init__(self):
        self.values = {}
        self.ttls = {}

    def pipeline(self):
        return FakePipeline(self)

    def incr(self, key):
        self.values[key] = self.values.get(key, 0) + 1
        return self.values[key]

    def expire(self, key, seconds, nx=False):
        if nx and key in self.ttls:
            return False
        self.ttls[key] = seconds
        return True

    def set(self, key, value, ex=None):
        self.values[key] = value
        self.ttls[key] = ex
        return True

    def ttl(self, key):
        return self.ttls.get(key, -1) if key in self.values else -2

    def delete(self, *keys):
        found = [key for key in keys if key in self.values]
        for key in keys:
            self.values.pop(key, None)
            self.ttls.pop(key, None)
        return len(found)


class BrokenRedis:
    def pipeline(self):
        raise redis.ConnectionError("down")

    def delete(self, *keys):
        raise redis.ConnectionError("down")


class FakeDB:
    """admin_users 한 행만 있는 세션 대역 - login()의 scalar(select)와 authenticate()의 get만 흉내 냄"""

    def __init__(self, admin):
        self.admin = admin

    def scalar(self, stmt):
        login_id = next(iter(stmt.compile().params.values()))
        return self.admin if self.admin and self.admin.login_id == login_id else None

    def get(self, model, admin_id):
        return self.admin if self.admin and self.admin.id == admin_id else None

    def commit(self):
        pass


@pytest.fixture(scope="module")
def password_hash():
    return auth.hash_password(PASSWORD)  # argon2는 느려서 한 번만 만듦


@pytest.fixture
def admin(password_hash):
    return AdminUser(
        id=1,
        login_id="admin",
        name="테스트 운영자",
        password_hash=password_hash,
        password_changed_at=datetime.now(UTC) - timedelta(days=1),
    )


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(auth, "_redis", fake)
    monkeypatch.setattr(settings, "jwt_secret", SecretStr(TEST_SECRET))
    return fake


# --- 실패 제한 ---


def test_id_locks_on_fifth_failure(fake_redis):
    for _ in range(4):
        auth.record_failure("admin", "1.1.1.1")
    assert auth.lock_remaining_seconds("admin", "1.1.1.1") == 0
    auth.record_failure("admin", "1.1.1.1")
    assert auth.lock_remaining_seconds("admin", "1.1.1.1") == settings.login_lock_seconds
    assert "login_fail:id:admin" not in fake_redis.values  # 잠금 후 횟수는 0부터


def test_id_lock_applies_from_other_ip():
    for _ in range(5):
        auth.record_failure("admin", "1.1.1.1")
    assert auth.lock_remaining_seconds("admin", "2.2.2.2") > 0


def test_ip_locks_after_twenty_failures_across_ids():
    for i in range(20):
        auth.record_failure(f"user{i}", "1.1.1.1")
    assert auth.lock_remaining_seconds("someone", "1.1.1.1") > 0
    assert auth.lock_remaining_seconds("someone", "2.2.2.2") == 0


def test_failure_window_is_not_extended(fake_redis):
    auth.record_failure("admin", "1.1.1.1")
    fake_redis.ttls["login_fail:id:admin"] = 10
    auth.record_failure("admin", "1.1.1.1")
    assert fake_redis.ttls["login_fail:id:admin"] == 10  # 실패할 때마다 창이 다시 늘어나지 않음


def test_clear_failures_keeps_ip_count(fake_redis):
    auth.record_failure("admin", "1.1.1.1")
    auth.clear_failures("admin")
    assert "login_fail:id:admin" not in fake_redis.values
    assert fake_redis.values["login_fail:ip:1.1.1.1"] == 1


def test_redis_down_does_not_block(monkeypatch):
    monkeypatch.setattr(auth, "_redis", BrokenRedis())
    auth.record_failure("admin", "1.1.1.1")
    auth.clear_failures("admin")
    assert auth.lock_remaining_seconds("admin", "1.1.1.1") == 0


# --- 비밀번호 · 토큰 ---


def test_verify_password(admin):
    assert auth.verify_password(admin, PASSWORD)
    assert not auth.verify_password(admin, "wrong-password")
    assert not auth.verify_password(None, PASSWORD)  # 없는 계정도 검증은 하고 실패


def test_token_round_trip(admin):
    now = datetime.now(UTC)
    token, expires_at = auth.issue_token(admin, now)
    session = auth.authenticate(FakeDB(admin), token)
    assert session.admin is admin
    assert session.expires_at == expires_at == now.replace(microsecond=0) + timedelta(hours=2)


def test_token_in_same_second_as_password_change_is_valid(admin):
    second = datetime.now(UTC).replace(microsecond=0)
    admin.password_changed_at = second.replace(microsecond=700_000)
    token, _ = auth.issue_token(admin, second.replace(microsecond=900_000))
    assert auth.authenticate(FakeDB(admin), token).admin is admin


def expired_token(admin):
    return auth.issue_token(admin, datetime.now(UTC) - timedelta(hours=3))[0]


def other_secret_token(admin):
    now = int(datetime.now(UTC).timestamp())
    claims = {"sub": "1", "iat": now, "exp": now + 60}
    return jwt.encode(claims, "other-secret-" + "y" * 32, algorithm="HS256")


def token_before_password_change(admin):
    token, _ = auth.issue_token(admin, datetime.now(UTC) - timedelta(seconds=5))
    admin.password_changed_at = datetime.now(UTC)
    return token


def token_of_deleted_admin(admin):
    token, _ = auth.issue_token(admin, datetime.now(UTC))
    admin.id = 2  # DB에는 id 2만 있음 = 토큰의 계정(1)은 삭제됨
    return token


@pytest.mark.parametrize(
    "make_token",
    [
        lambda admin: None,
        lambda admin: "not-a-jwt",
        expired_token,
        other_secret_token,
        token_before_password_change,
        token_of_deleted_admin,
    ],
)
def test_invalid_token_is_401(admin, make_token):
    token = make_token(admin)
    with pytest.raises(ApiError) as error:
        auth.authenticate(FakeDB(admin), token)
    assert (error.value.status_code, error.value.code) == (401, "UNAUTHORIZED")


def test_missing_secret_is_500(admin, monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret", SecretStr(""))
    with pytest.raises(ApiError) as error:
        auth.issue_token(admin, datetime.now(UTC))
    assert error.value.status_code == 500


def make_request(headers):
    raw = [(k.encode(), v.encode()) for k, v in headers.items()]
    return Request({"type": "http", "headers": raw, "client": ("172.18.0.5", 50000)})


def test_client_ip():
    assert auth.client_ip(make_request({"x-real-ip": "203.0.113.7"})) == "203.0.113.7"
    assert auth.client_ip(make_request({})) == "172.18.0.5"  # nginx 없이 직접 호출


# --- 엔드포인트 ---


@pytest.fixture
def client(admin, monkeypatch):
    app.dependency_overrides[get_db] = lambda: FakeDB(admin)
    # TestClient는 http라 Secure 쿠키를 다시 보내지 않음
    monkeypatch.setitem(auth_api.COOKIE_OPTIONS, "secure", False)
    yield TestClient(app)
    app.dependency_overrides.clear()


def post_login(client, login_id="admin", password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"loginId": login_id, "password": password})


def test_login_me_logout(client, admin):
    res = post_login(client)
    assert res.status_code == 200
    body = res.json()
    assert body["admin"] == {"loginId": "admin", "name": "테스트 운영자"}
    assert body["expiresAt"].endswith("+09:00")
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/api" in cookie
    assert admin.last_login_at is not None

    assert client.get("/api/v1/auth/me").json() == body
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_locked_after_five_wrong_passwords(client):
    for _ in range(5):
        res = post_login(client, password="wrong-password")
        assert res.json()["error"]["code"] == "INVALID_CREDENTIALS"
    res = post_login(client)  # 맞는 비밀번호여도 잠금 중이면 429
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "LOGIN_LOCKED"
    assert int(res.headers["retry-after"]) == settings.login_lock_seconds


def test_unknown_id_is_counted_and_locked_alone(client):
    for _ in range(5):
        assert post_login(client, login_id="ghost").status_code == 401
    assert post_login(client, login_id="ghost").status_code == 429
    assert post_login(client).status_code == 200  # 다른 아이디는 그대로 (IP는 5/20) - 시연 방법


def test_empty_login_is_422(client):
    res = client.post("/api/v1/auth/login", json={"loginId": "", "password": ""})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_logout_and_me_without_cookie_are_401(client):
    assert client.get("/api/v1/auth/me").json()["error"]["code"] == "UNAUTHORIZED"
    assert client.post("/api/v1/auth/logout").status_code == 401
