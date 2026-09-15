import threading

import boto3
import httpx
import pytest
from botocore.stub import Stubber
from serve import make_server

import t4_lambda_faraday as faraday
from t4_lambda_faraday.session import Session


@pytest.fixture
def viewer():
    server = make_server(0)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    with httpx.Client(
        base_url=f"http://127.0.0.1:{server.server_port}",
        headers={"X-Faraday-Runner": "1"},
        timeout=20,
        trust_env=False,
    ) as client:
        yield client
    server.shutdown()
    server.server_close()
    worker.join(timeout=5)


def test_page_and_config_default_to_protology_without_exposing_secrets(viewer, monkeypatch):
    monkeypatch.setenv("QUILT_API_KEY", "never-return-this-key")
    monkeypatch.setenv("FARADAY_MCP_URL", "https://example.com/mcp?private-parameter")
    page = viewer.get("/")
    assert page.status_code == 200
    assert 'value="s3://protology"' in page.text
    assert "frame-ancestors 'none'" in page.headers["content-security-policy"]
    config = viewer.get("/api/config")
    assert config.json()["registry"] == "s3://protology"
    assert config.json()["mcp"] is True
    assert "never-return-this-key" not in config.text
    assert "private-parameter" not in config.text


def test_http_create_run_view_and_read_pinned_file(viewer, registry, monkeypatch, tmp_path):
    ref = {"registry": registry, "package": "faraday/browser"}
    created = viewer.post("/api/invoke", json={"action": "init", "session": ref, "agents": "Use evidence."})
    assert created.status_code == 200
    assert created.json()["status"] == "ready"
    assert viewer.post("/api/sessions", json={"session": ref}).json()["packages"] == ["faraday/browser"]
    bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")
    stub = Stubber(bedrock)
    stub.add_response(
        "converse",
        {
            "output": {"message": {"role": "assistant", "content": [{"text": "Browser report."}]}},
            "stopReason": "end_turn",
            "usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2},
            "metrics": {"latencyMs": 1},
        },
    )
    real_client = boto3.client
    monkeypatch.setattr(
        faraday.boto3,
        "client",
        lambda name, **kwargs: bedrock if name == "bedrock-runtime" else real_client(name, **kwargs),
    )
    with stub:
        result = viewer.post("/api/invoke", json={"session": ref, "task": "Write a report."})
        assert result.status_code == 200
        assert result.json()["status"] == "completed"
        stub.assert_no_pending_responses()
    snapshot = viewer.post("/api/session", json={"session": ref}).json()
    assert snapshot["agents"] == "Use evidence."
    assert snapshot["messages"][-1]["content"][0]["text"] == "Browser report."
    output = result.json()["output"]
    assert output in snapshot["files"]
    changed = Session.load(registry, ref["package"], tmp_path)
    changed.write(output, "A later version")
    changed.save()
    pinned = viewer.post(
        "/api/file", json={"session": ref, "top_hash": snapshot["session"]["top_hash"], "path": output}
    )
    assert pinned.status_code == 200
    assert pinned.json()["text"] == "Browser report."


@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": "https://unrelated.example"},
        {"Origin": "null"},
        {"Host": "rebound.example"},
        {"X-Faraday-Runner": ""},
        {"Content-Type": "text/plain"},
    ],
)
def test_reject_cross_origin_and_unmarked_requests(viewer, headers):
    response = viewer.post("/api/invoke", json={}, headers=headers)
    assert response.status_code == 403


def test_expected_errors_are_actionable(viewer, registry):
    ref = {"registry": registry, "package": "faraday/missing"}
    missing = viewer.post("/api/session", json={"session": ref})
    assert missing.status_code == 404
    assert "not found" in missing.json()["error"]
    invalid = viewer.post("/api/session", json={"session": {"registry": "invalid", "package": "bad"}})
    assert invalid.status_code == 400
    assert viewer.get("/../serve.py").status_code == 404


def test_invalid_json_and_oversized_requests(viewer):
    assert viewer.post("/api/invoke", content="{", headers={"Content-Type": "application/json"}).status_code == 400
    assert viewer.post("/api/invoke", json={"oversized": "x" * (512 * 1024)}).status_code == 413
