from base64 import b64decode, b64encode
import importlib
import sys

from fastapi import FastAPI, HTTPException, Request, Response

sys.path.extend([
    '../lambdas/shared/',
    '../lambdas/',
])

SUPPORTED_LAMBDAS = frozenset([
    'thumbnail',
    'preview',
    's3select',
])


lambdas = FastAPI()


@lambdas.api_route("/{name}", methods=['GET', 'POST', 'OPTIONS'])
@lambdas.api_route("/{name}/{path:path}", methods=['GET', 'POST', 'OPTIONS'])
async def lambda_request(request: Request, name: str, path: str = ''):
    if name not in SUPPORTED_LAMBDAS:
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

    module = importlib.import_module(f'{name}.index')

    result = module.lambda_handler(args, None)

    code = result['statusCode']
    headers = result['headers']
    body = result['body']
    encoded = result.get("isBase64Encoded", False)

    if encoded:
        body = b64decode(body)
    else:
        body = body.encode()

    return Response(content=body, status_code=code, headers=headers)
