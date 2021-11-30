import importlib
import sys
from base64 import b64decode, b64encode

from fastapi import FastAPI, HTTPException, Request, Response

from . import preview, s3select, thumbnail

LAMBDAS = {
    "thumbnail": thumbnail,
    "preview": preview,
    "s3select": s3select,
}


lambdas = FastAPI()


@lambdas.api_route("/{name}", methods=['GET', 'POST', 'OPTIONS'])
@lambdas.api_route("/{name}/{path:path}", methods=['GET', 'POST', 'OPTIONS'])
async def lambda_request(request: Request, name: str, path: str = ''):
    if name not in LAMBDAS:
        raise HTTPException(404, "No such lambda")

    req_body = await request.body()

    args = {
        'httpMethod': request.method,
        'path': request.url.path,
        'pathParameters': {
            'proxy': path
        },
        'queryStringParameters': dict(request.query_params) or None,
        'headers': request.headers or None,  # FastAPI makes headers lower-case, just like AWS.
        'body': b64encode(req_body),
        'isBase64Encoded': True
    }

    result = LAMBDAS[name].lambda_handler(args, None)

    code = result['statusCode']
    headers = result['headers']
    body = result['body']
    encoded = result.get("isBase64Encoded", False)
    content = b64decode(body) if encoded else body.encode()

    return Response(content=content, status_code=code, headers=headers)
