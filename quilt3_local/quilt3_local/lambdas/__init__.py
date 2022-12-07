import asyncio
import base64
import functools
import importlib
import sys

import fastapi

from . import preview, s3select, tabular_preview, thumbnail

LAMBDAS = {
    "thumbnail": thumbnail,
    "preview": preview,
    "s3select": s3select,
    "tabular-preview": tabular_preview,
}

lambdas = fastapi.FastAPI()


@lambdas.api_route("/{name}", methods=["GET", "POST", "OPTIONS"])
@lambdas.api_route("/{name}/{path:path}", methods=["GET", "POST", "OPTIONS"])
async def lambda_request(request: fastapi.Request, name: str, path: str = ""):
    if name not in LAMBDAS:
        raise fastapi.HTTPException(404, "No such lambda")

    req_body = await request.body()

    args = {
        "httpMethod": request.method,
        "path": request.url.path,
        "pathParameters": {"proxy": path},
        "queryStringParameters": dict(request.query_params) or None,
        "headers": request.headers or None,  # FastAPI makes headers lower-case, just like AWS.
        "body": base64.b64encode(req_body),
        "isBase64Encoded": True,
    }

    result = await asyncio.get_running_loop().run_in_executor(
        None,
        functools.partial(LAMBDAS[name].lambda_handler, args, None),
    )

    code = result["statusCode"]
    headers = result["headers"]
    body = result["body"]
    encoded = result.get("isBase64Encoded", False)
    if encoded:
        content = base64.b64decode(body)
    elif isinstance(body, memoryview):
        content = body.tobytes()
    else:
        content = body.encode()

    return fastapi.Response(content=content, status_code=code, headers=headers)
