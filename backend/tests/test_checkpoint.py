import os

# app.config가 import 시점에 필수 설정을 읽음 - .env가 없는 환경(CI)에서도 돌도록 가짜 값을 넣음
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test")
os.environ.setdefault("EV_SERVICE_KEY", "test")

from types import SimpleNamespace  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.collector import checkpoint  # noqa: E402
from app.config import settings  # noqa: E402


def make_run(status="SUCCESS", matched_count=176, run_id=31939):
    return SimpleNamespace(id=run_id, status=status, matched_count=matched_count)


class FakePost:
    """응답을 차례로 돌려주는 httpx.post 대역 - 예외 객체면 던짐"""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.urls = []

    def __call__(self, url, timeout=None):
        self.urls.append(url)
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setattr(settings, "producer_url", "http://producer:8002/")
    monkeypatch.setattr(checkpoint, "BUSY_WAIT_SEC", 0)


def use(monkeypatch, *responses):
    fake = FakePost(*responses)
    monkeypatch.setattr(checkpoint.httpx, "post", fake)
    return fake


def ok():
    return httpx.Response(
        200, json={"status": "OK", "publication": "atomic_publish", "seconds": 1.9}
    )


def test_published_run_returns_true(monkeypatch):
    fake = use(monkeypatch, ok())
    assert checkpoint.publish_checkpoint(make_run()) is True
    assert fake.urls == ["http://producer:8002/runs/31939"]


@pytest.mark.parametrize(
    "run",
    [make_run(status="FAILED"), make_run(status="RUNNING"), make_run(matched_count=0)],
)
def test_runs_without_observations_are_skipped(monkeypatch, run):
    fake = use(monkeypatch)
    assert checkpoint.publish_checkpoint(run) is False
    assert fake.urls == []


def test_skipped_without_producer_url(monkeypatch):
    monkeypatch.setattr(settings, "producer_url", "")
    fake = use(monkeypatch)
    assert checkpoint.publish_checkpoint(make_run()) is False
    assert fake.urls == []


def test_partial_run_is_published(monkeypatch):
    use(monkeypatch, ok())
    assert checkpoint.publish_checkpoint(make_run(status="PARTIAL", matched_count=170)) is True


def test_busy_retries_same_run_then_succeeds(monkeypatch):
    busy = httpx.Response(409, json={"status": "BUSY"})
    fake = use(monkeypatch, busy, busy, ok())
    assert checkpoint.publish_checkpoint(make_run()) is True
    assert len(fake.urls) == 3
    assert set(fake.urls) == {"http://producer:8002/runs/31939"}


def test_busy_gives_up_after_retries(monkeypatch):
    busy = httpx.Response(409, json={"status": "BUSY"})
    fake = use(monkeypatch, busy, busy, busy)
    assert checkpoint.publish_checkpoint(make_run()) is False
    assert len(fake.urls) == 3


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(503, json={"reason": "checkpoint_not_initialized"}),
        httpx.Response(503, json={"reason": "checkpoint_source_changed_during_build_reinitialize"}),
        httpx.Response(500, json={"error_type": "OperationalError"}),
        httpx.Response(504, json={"reason": "producer_timeout"}),
        httpx.Response(502, text="bad gateway"),
        httpx.Response(200, json=["not", "a", "dict"]),
        httpx.ConnectError("refused"),
        httpx.ReadTimeout("timeout"),
    ],
)
def test_failures_return_false_without_raising(monkeypatch, response):
    use(monkeypatch, response)
    result = checkpoint.publish_checkpoint(make_run())
    # 200이지만 본문이 dict가 아니어도 게시는 된 것 - 로그 값만 비게 됨
    expected = isinstance(response, httpx.Response) and response.status_code == 200
    assert result is expected
