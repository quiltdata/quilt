from __future__ import annotations

from typing import TYPE_CHECKING

import aiohttp
import fastapi

if TYPE_CHECKING:
    from ..lambda_subprocess import LambdaManager

lambdas = fastapi.FastAPI()

_http_session: aiohttp.ClientSession | None = None


def _get_session() -> aiohttp.ClientSession:
    global _http_session
    if _http_session is None:
        _http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
        )
    return _http_session


async def close_client() -> None:
    global _http_session
    if _http_session is not None:
        await _http_session.close()
        _http_session = None


def _get_manager(request: fastapi.Request) -> LambdaManager:
    return request.app.state.lambda_manager


@lambdas.api_route("/{name}", methods=["GET", "POST", "OPTIONS"])
@lambdas.api_route("/{name}/{path:path}", methods=["GET", "POST", "OPTIONS"])
async def lambda_request(request: fastapi.Request, name: str, path: str = ""):
    manager: LambdaManager = _get_manager(request)
    port = manager.get_port(name)
    if port is None:
        raise fastapi.HTTPException(503, f"Lambda '{name}' is not available")

    session = _get_session()
    target_path = f"/lambda/{path}" if path else "/lambda"
    url = f"http://127.0.0.1:{port}{target_path}"

    body = await request.body()

    forward_headers = {
        k: v for k, v in request.headers.items() if k.lower() not in ("host", "transfer-encoding", "connection")
    }

    async with session.request(
        method=request.method,
        url=url,
        headers=forward_headers,
        params=dict(request.query_params),
        data=body if body else None,
        allow_redirects=False,
    ) as resp:
        content = await resp.read()
        excluded_headers = {"transfer-encoding", "connection", "content-length", "content-encoding"}
        resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded_headers}

        return fastapi.Response(
            content=content,
            status_code=resp.status,
            headers=resp_headers,
        )
