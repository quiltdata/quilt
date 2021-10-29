"""
Decorators for using lambdas in API Gateway
"""

import gzip
import traceback
import urllib.parse
from base64 import b64decode, b64encode
from functools import wraps

from jsonschema import Draft4Validator, ValidationError

GZIP_MIN_LENGTH = 1024
GZIP_TYPES = {'text/plain', 'application/json'}
# Used, e.g., for binary responses when metadata belongs in headers, not body
QUILT_INFO_HEADER = 'X-Quilt-Info'


class Request:
    """
    Wraps a lambda event in an object similar to a Flask Request:
    http://flask.pocoo.org/docs/1.0/api/#flask.Request
    """
    def __init__(self, event, context):
        self.event = event
        self.context = context
        self.method = event['httpMethod']
        self.path = event['path']
        self.pathParameters = event.get('pathParameters')
        self.headers = event['headers'] or {}
        self.args = event['queryStringParameters'] or {}
        if event['isBase64Encoded']:
            self.data = b64decode(event['body'])
        else:
            self.data = event['body']


class ELBRequest(Request):
    def __init__(self, event, context):
        super().__init__(event, context)
        # ELB pass queryStringParameters escaped.
        self.args = dict(
            urllib.parse.parse_qsl(
                '&'.join(
                    f'{k}={v}'
                    for k, v in self.args.items()
                )
            )
        )


def api(cors_origins=(), *, request_class=Request):
    def innerdec(f):
        @wraps(f)
        def wrapper(event, context):
            request = request_class(event, context)
            if request.method == 'OPTIONS':
                status = 200
                response_headers = {}
                body = ''
                encoded = False
            else:
                try:
                    status, body, response_headers = f(request)
                except Exception as ex:
                    traceback.print_exc()
                    status = 500
                    body = str(ex)
                    response_headers = {
                        'Content-Type': 'text/plain'
                    }

                content_type = response_headers.get('Content-Type')
                if len(body) >= GZIP_MIN_LENGTH and content_type in GZIP_TYPES:
                    if isinstance(body, str):
                        body = body.encode()
                    body = gzip.compress(body)
                    response_headers.update({
                        'Content-Encoding': 'gzip'
                    })

                if isinstance(body, bytes):
                    body = b64encode(body).decode()
                    encoded = True
                else:
                    encoded = False

            origin = request.headers.get('origin')
            if origin is not None and origin in cors_origins:
                response_headers.update({
                    'access-control-allow-origin': '*',
                    'access-control-allow-methods': 'OPTIONS,HEAD,GET,POST',
                    'access-control-allow-headers': (
                        request.headers.get('access-control-request-headers', '')
                    ),
                    # for preflight checks, not sure we need it for header to work?
                    # https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers
                    'access-control-expose-headers': (
                        f"*, Authorization, {QUILT_INFO_HEADER}"
                    ),
                    'access-control-max-age': '86400',
                })

            return {
                "statusCode": status,
                "body": body,
                "isBase64Encoded": encoded,
                "headers": response_headers
            }
        return wrapper
    return innerdec


def validate(schema):
    Draft4Validator.check_schema(schema)
    validator = Draft4Validator(schema)

    def innerdec(f):
        @wraps(f)
        def wrapper(request):
            try:
                validator.validate(request.args)
            except ValidationError as ex:
                return 400, str(ex), {'Content-Type': 'text/plain'}

            return f(request)
        return wrapper
    return innerdec
