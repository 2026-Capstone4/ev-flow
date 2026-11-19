import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402


@pytest.fixture
def state(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "STATE_DIR", tmp_path)
    (tmp_path / "latest.json").write_text("{}")
    return tmp_path


def fake_run(monkeypatch, returncode=0, stdout="", stderr="", raises=None):
    calls = []

    def run(command, **kwargs):
        calls.append(command)
        if raises:
            raise raises
        return SimpleNamespace(returncode=returncode, stdout=stdout, stderr=stderr)

    monkeypatch.setattr(server.subprocess, "run", run)
    return calls


def line(**value):
    return json.dumps(value) + "\n"


@pytest.mark.parametrize("kind", ["atomic_publish", "duplicate_noop"])
def test_published_is_200(state, monkeypatch, kind):
    out = line(
        run_id=7,
        kind="incremental",
        seconds=1.5,
        publication={"kind": kind, "publish_seconds": 0.4},
    )
    calls = fake_run(monkeypatch, stdout="경고 줄\n" + out)
    code, body = server.run_producer(7)
    assert code == 200
    assert body["publication"] == kind
    assert body["seconds"] == 1.9
    command = calls[0]
    assert command[2].endswith("maintain_checkpoint.py")
    assert command[3:] == ["--run-id", "7", "--publish-postgres", "--checkpoint-dir", str(state)]
    assert "--initialize" not in command


def test_not_initialized_is_503_without_subprocess(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "STATE_DIR", tmp_path)
    calls = fake_run(monkeypatch)
    assert server.run_producer(7) == (
        503,
        {"status": "ERROR", "reason": "checkpoint_not_initialized"},
    )
    assert calls == []


def test_other_run_id_is_not_success(state, monkeypatch):
    out = line(run_id=8, publication={"kind": "atomic_publish", "publish_seconds": 0.1})
    fake_run(monkeypatch, stdout=out)
    assert server.run_producer(7)[0] == 500


def test_busy_is_409(state, monkeypatch):
    fake_run(monkeypatch, returncode=1, stdout=line(status="ERROR", reason=server.BUSY))
    assert server.run_producer(7)[0] == 409


@pytest.mark.parametrize(
    "reason",
    [
        "checkpoint_source_changed_during_build_reinitialize",
        "checkpoint_late_observation_or_duplicate_requires_rebuild",
        "checkpoint_incompatible_binding",
        "checkpoint_missing_run_initialize_first",
    ],
)
def test_rebuild_reasons_are_503(state, monkeypatch, reason):
    fake_run(monkeypatch, returncode=1, stdout=line(status="ERROR", reason=reason))
    code, body = server.run_producer(7)
    assert code == 503
    assert body["rebuild_required"] is True


def test_unknown_error_is_500(state, monkeypatch):
    out = line(status="ERROR", error_type="OperationalError", sqlstate=None)
    fake_run(monkeypatch, returncode=1, stdout=out)
    code, body = server.run_producer(7)
    assert code == 500
    assert body["error_type"] == "OperationalError"


def test_crash_without_json_is_500(state, monkeypatch):
    fake_run(monkeypatch, returncode=1, stderr="ModuleNotFoundError: pandas")
    assert server.run_producer(7)[0] == 500


def test_timeout_is_504(state, monkeypatch):
    fake_run(monkeypatch, raises=subprocess.TimeoutExpired(cmd="x", timeout=100))
    assert server.run_producer(7)[0] == 504


@pytest.mark.parametrize("path", ["/runs/0", "/runs/-1", "/runs/abc", "/runs/1/x", "/other"])
def test_route_rejects_bad_paths(path):
    assert server.ROUTE.match(path) is None
