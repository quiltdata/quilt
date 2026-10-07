import asyncio
from copy import deepcopy

import pytest

from t4_lambda_faraday.runner import Limits, run
from t4_lambda_faraday.session import Session
from t4_lambda_faraday.tools import Tools


def reply(*content, stop="end_turn"):
    return {
        "output": {"message": {"role": "assistant", "content": list(content)}},
        "stopReason": stop,
        "usage": {"inputTokens": 10, "outputTokens": 5, "totalTokens": 15},
    }


class Bedrock:
    def __init__(self, *responses):
        self.responses = iter(responses)
        self.requests = []

    def converse(self, **kwargs):
        self.requests.append(deepcopy(kwargs))
        response = next(self.responses)
        if isinstance(response, Exception):
            raise response
        return response

    def close(self):
        pass


def test_run_then_resume_with_updated_prompt(registry, tmp_path):
    session = Session.create(registry, "faraday/demo", tmp_path, "First system prompt")
    session.save()
    bedrock = Bedrock(
        reply(
            {
                "toolUse": {
                    "toolUseId": "write1",
                    "name": "session_write",
                    "input": {"path": "outputs/report.md", "text": "Evidence"},
                }
            },
            stop="tool_use",
        ),
        reply({"text": "Report saved."}),
    )
    first = asyncio.run(run(session, "Write a report", "test-model", bedrock, Tools(session)))
    assert first["status"] == "completed"
    assert first["usage"]["totalTokens"] == 30
    assert bedrock.requests[0]["system"] == [{"text": "First system prompt"}]
    assert bedrock.requests[1]["messages"][-1]["content"][0]["toolResult"]["toolUseId"] == "write1"
    session = Session.load(registry, "faraday/demo", tmp_path)
    assert session.read("outputs/report.md") == "Evidence"
    session.write("AGENTS.md", "New system prompt")
    session.save()
    resumed = Session.load(registry, "faraday/demo", tmp_path)
    second_model = Bedrock(reply({"text": "Follow-up answer."}))
    second = asyncio.run(run(resumed, "Follow up", "test-model", second_model, Tools(resumed)))
    assert second["session"]["top_hash"] != first["session"]["top_hash"]
    assert second_model.requests[0]["system"] == [{"text": "New system prompt"}]
    assert second_model.requests[0]["messages"][1]["content"][0]["toolUse"]["toolUseId"] == "write1"
    assert len(Session.load(registry, "faraday/demo", tmp_path).state["runs"]) == 2


def test_tool_errors_and_turn_limit_leave_resumable_history(registry, tmp_path):
    session = Session.create(registry, "faraday/demo", tmp_path, "Instructions")
    session.save()
    model = Bedrock(
        reply(
            {"toolUse": {"toolUseId": "1", "name": "session_write", "input": {"path": "AGENTS.md", "text": "oops"}}},
            {"toolUse": {"toolUseId": "2", "name": "session_read", "input": {"path": "AGENTS.md"}}},
            stop="tool_use",
        )
    )
    result = asyncio.run(run(session, "Try tools", "test", model, Tools(session), Limits(turns=1)))
    assert result["status"] == "limit_reached"
    restored = Session.load(registry, "faraday/demo", tmp_path)
    assert restored.read("AGENTS.md") == "Instructions"
    results = restored.messages[-1]["content"]
    assert [r["toolResult"]["status"] for r in results] == ["error", "success"]
    assert [r["toolResult"]["toolUseId"] for r in results] == ["1", "2"]
    resumed_model = Bedrock(reply({"text": "Continued after the limit."}))
    resumed = asyncio.run(run(restored, "Continue", "test", resumed_model, Tools(restored)))
    assert resumed["status"] == "completed"
    sent = resumed_model.requests[0]["messages"]
    assert [m["role"] for m in sent] == ["user", "assistant", "user"]
    assert sent[-1]["content"][:2] == results
    assert sent[-1]["content"][-1] == {"text": "Continue"}


@pytest.mark.parametrize(
    "response,status",
    [
        (RuntimeError("secret-token-do-not-persist"), "failed"),
        (reply({"text": "Partial"}, stop="max_tokens"), "incomplete"),
    ],
)
def test_failed_and_truncated_runs_are_saved(registry, tmp_path, response, status):
    session = Session.create(registry, "faraday/demo", tmp_path, "Instructions")
    session.save()
    result = asyncio.run(run(session, "Task", "test", Bedrock(response), Tools(session)))
    assert result["status"] == status
    restored = Session.load(registry, "faraday/demo", tmp_path)
    assert restored.state["status"] == status
    assert "secret-token" not in restored.read("session.json")


def test_time_limit_stops_before_inference(registry, tmp_path):
    session = Session.create(registry, "faraday/demo", tmp_path, "Instructions")
    session.save()
    model = Bedrock()
    result = asyncio.run(run(session, "Task", "test", model, Tools(session), Limits(seconds=0)))
    assert result["status"] == "limit_reached"
    assert not model.requests
