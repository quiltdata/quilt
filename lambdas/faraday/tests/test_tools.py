import asyncio
import json

import httpx
import pytest

from t4_lambda_faraday import tools as tools_module
from t4_lambda_faraday.session import Session
from t4_lambda_faraday.tools import Tools, connect


def test_real_mcp_client_handshake_pagination_sse_and_tool_result(monkeypatch, registry, tmp_path):
    requests = []

    def handle(request):
        body = json.loads(request.content)
        requests.append((dict(request.headers), body))
        method = body["method"]
        if method == "notifications/initialized":
            return httpx.Response(202)
        if method == "initialize":
            result = {
                "protocolVersion": body["params"]["protocolVersion"],
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "test", "version": "1"},
            }
        elif method == "tools/list":
            second_page = body.get("params", {}).get("cursor") == "next"
            result = {
                "tools": [
                    {
                        "name": "second" if second_page else "search",
                        "inputSchema": {"type": "object", "properties": {}},
                    }
                ]
            }
            if not second_page:
                result["nextCursor"] = "next"
        elif method == "tools/call":
            assert body["params"]["name"] == "search"
            result = {
                "content": [
                    {"type": "text", "text": "Found evidence"},
                    {"type": "image", "mimeType": "image/png", "data": "YWJj"},
                ],
                "structuredContent": {"count": 1},
                "isError": False,
            }
            payload = json.dumps({"jsonrpc": "2.0", "id": body["id"], "result": result})
            return httpx.Response(
                200, headers={"content-type": "text/event-stream"}, text=f"event: message\ndata: {payload}\n\n"
            )
        else:
            raise AssertionError(method)
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "result": result})

    real_client = httpx.AsyncClient

    def client(**kwargs):
        assert kwargs["follow_redirects"] is False
        return real_client(transport=httpx.MockTransport(handle), **kwargs)

    monkeypatch.setattr(tools_module.httpx, "AsyncClient", client)
    session = Session.create(registry, "faraday/demo", tmp_path, "Instructions")

    async def scenario():
        async with connect(session, "https://mcp.example/mcp", "test-key", 10) as tools:
            assert len(tools.specs) == 4
            name = next(n for n, remote in tools.remote_names.items() if remote == "search")
            assert len(name) <= 64
            result = await tools.execute(name, {})
            assert result["status"] == "success"
            assert result["content"] == [
                {"text": "Found evidence"},
                {"image": {"format": "png", "source": {"bytes": b"abc"}}},
                {"json": {"count": 1}},
            ]

    asyncio.run(scenario())
    assert requests[0][1]["method"] == "initialize"
    assert all(headers["authorization"] == "Bearer test-key" for headers, _ in requests)
    assert all("test-key" not in json.dumps(body) for _, body in requests)


@pytest.mark.parametrize("path", ["AGENTS.md", "session.json", "../escape", "outputs/../../escape", "/outside/escape"])
def test_session_tool_cannot_write_outside_outputs(registry, tmp_path, path):
    session = Session.create(registry, "faraday/demo", tmp_path, "Instructions")
    with pytest.raises(ValueError):
        asyncio.run(Tools(session).execute("session_write", {"path": path, "text": "overwrite"}))


def test_missing_mcp_credentials_fails_before_connection(registry, tmp_path):
    session = Session.create(registry, "faraday/demo", tmp_path, "Instructions")

    async def scenario():
        async with connect(session, "https://example.com/mcp", None, 10):
            pytest.fail("Must not connect without credentials")

    with pytest.raises(ValueError, match="QUILT_API_KEY"):
        asyncio.run(scenario())
