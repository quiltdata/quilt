import json

import boto3
import pytest
from botocore.stub import Stubber
from pydantic import ValidationError

import t4_lambda_faraday as faraday
from t4_lambda_faraday.__main__ import main
from t4_lambda_faraday.session import Session


def test_cli_init_and_lambda_run_use_same_package(registry, tmp_path, capsys, monkeypatch):
    agents = tmp_path / "agents.md"
    agents.write_text("You write concise reports.")
    assert main(["init", "--registry", registry, "--session", "faraday/demo", "--agents", str(agents)]) == 0
    created = json.loads(capsys.readouterr().out)
    assert created["status"] == "ready"
    bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")
    stub = Stubber(bedrock)
    # Botocore validates the real request and response shapes, beyond the runner's test double.
    stub.add_response(
        "converse",
        {
            "output": {"message": {"role": "assistant", "content": [{"text": "Done."}]}},
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
        result = faraday.lambda_handler(
            {"session": {"registry": registry, "package": "faraday/demo"}, "task": "Report"}, None
        )
        stub.assert_no_pending_responses()
    assert result["status"] == "completed"
    loaded = Session.load(registry, "faraday/demo", tmp_path)
    assert loaded.messages[-1]["content"] == [{"text": "Done."}]
    assert loaded.read(result["output"]) == "Done."


@pytest.mark.parametrize("extra", [{"agents": "overwrite", "task": "run"}, {"task": " "}, {}, {"api_key": "secret"}])
def test_reject_invalid_run_requests(extra):
    with pytest.raises((ValueError, ValidationError)):
        faraday.lambda_handler(
            {"session": {"registry": "s3://faraday-test", "package": "faraday/demo"}, **extra}, None
        )


def test_lambda_reserves_time_for_package_save():
    class Context:
        def get_remaining_time_in_millis(self):
            return 10000

    with pytest.raises(ValueError, match="31 seconds"):
        faraday.lambda_handler(
            {"session": {"registry": "s3://faraday-test", "package": "faraday/demo"}, "task": "Run"}, Context()
        )
