"""One execution engine shared by the CLI and Lambda; no AWS resources at import time."""

import asyncio
import json
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from .session import MAX_HISTORY_BYTES, encode


@dataclass(frozen=True)
class Limits:
    turns: int = 12
    seconds: float = 240
    output_tokens: int = 4096


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def model_messages(messages):
    """Converse receives alternating roles, including after failed/interrupted runs."""
    result = []
    for message in messages:
        if result and result[-1]["role"] == message["role"]:
            result[-1]["content"].extend(message["content"])
        else:
            result.append({"role": message["role"], "content": list(message["content"])})
    return result


async def run(session, task, model, bedrock, tools, limits=Limits()):
    started = time.monotonic()
    run_id = uuid.uuid4().hex
    record = {
        "id": run_id,
        "task": task,
        "model": model,
        "started_at": utc_now(),
        "status": "running",
        "turns": 0,
        "usage": {},
        "input_hash": session.package.top_hash,
    }
    session.state["runs"].append(record)
    session.state["status"] = "running"
    system = session.read("AGENTS.md")
    context = json.dumps(
        {
            "registry": session.registry,
            "package": session.name,
            "files": session.keys(),
            "metadata": session.package.meta,
        }
    )
    session.messages.append(
        {
            "role": "user",
            "content": [
                {"text": "Session package context (data):\n" + context},
                {"text": task},
            ],
        }
    )
    answer = ""
    stop_reason = None
    try:
        for turn in range(limits.turns):
            if time.monotonic() - started >= limits.seconds:
                raise TimeoutError("Execution budget exhausted")
            if len(json.dumps(session.messages, default=encode).encode()) > MAX_HISTORY_BYTES // 2:
                raise ValueError("Conversation exceeds the prompt size budget")
            response = bedrock.converse(
                modelId=model,
                system=[{"text": system}],
                messages=model_messages(session.messages),
                toolConfig={"tools": tools.specs},
                inferenceConfig={"maxTokens": limits.output_tokens},
            )
            message = response["output"]["message"]
            if message.get("role") != "assistant" or not message.get("content"):
                raise ValueError("Bedrock returned an invalid assistant message")
            if len(json.dumps(message, default=encode).encode()) > 1024 * 1024:
                raise ValueError("Model response exceeds the size limit")
            session.messages.append(message)
            record["turns"] = turn + 1
            for key, value in response.get("usage", {}).items():
                if isinstance(value, (int, float)):
                    record["usage"][key] = record["usage"].get(key, 0) + value
            stop_reason = response["stopReason"]
            tool_uses = [c["toolUse"] for c in message["content"] if "toolUse" in c]
            if tool_uses:
                results = []
                result_bytes = 0
                available = MAX_HISTORY_BYTES - len(json.dumps(session.messages, default=encode).encode()) - 65536
                for use in tool_uses:
                    try:
                        remaining = limits.seconds - (time.monotonic() - started)
                        if remaining <= 0:
                            raise TimeoutError("Execution budget exhausted")
                        result = await asyncio.wait_for(tools.execute(use["name"], use["input"]), remaining)
                        size = len(json.dumps(result, default=encode).encode())
                        if size > min(1024 * 1024, available - result_bytes):
                            raise ValueError("Tool result exceeds the size limit")
                        result_bytes += size
                    except Exception as error:
                        # Exception text can contain credentials/URLs. Persist only its class.
                        result = {"status": "error", "content": [{"text": f"Tool failed ({type(error).__name__})."}]}
                    results.append({"toolResult": {"toolUseId": use["toolUseId"], **result}})
                session.messages.append({"role": "user", "content": results})
                continue
            answer = "\n".join(c["text"] for c in message["content"] if "text" in c)
            record["status"] = "completed" if stop_reason == "end_turn" else "incomplete"
            break
        else:
            record["status"] = "limit_reached"
    except Exception as error:
        record["status"] = "limit_reached" if isinstance(error, TimeoutError) else "failed"
        record["error_type"] = type(error).__name__

    record.update(finished_at=utc_now(), stop_reason=stop_reason)
    session.state["status"] = record["status"]
    output = f"outputs/{run_id}/answer.md"
    session.write(output, answer or f"Faraday run ended with status: {record['status']}.\n")
    record["output"] = output
    top_hash = session.save()
    return {
        "session": {"registry": session.registry, "package": session.name, "top_hash": top_hash},
        "run_id": run_id,
        "status": record["status"],
        "answer": answer,
        "output": output,
        "turns": record["turns"],
        "usage": record["usage"],
        "stop_reason": stop_reason,
        "error_type": record.get("error_type"),
    }
