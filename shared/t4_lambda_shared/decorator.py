"""
Decorators for using lambdas in API Gateway
"""

from base64 import b64encode
from functools import wraps
import json
import traceback

from jsonschema import Draft4Validator, ValidationError


class Request(object):
    """
    Wraps a lambda event in an object similar to a Flask Request:
    http://flask.pocoo.org/docs/1.0/api/#flask.Request
    """
    def __init__(self, event):
        self.event = event
        self.method = event['httpMethod']
        self.path = event['path']
        self.headers = event['headers'] or {}
        self.args = event['queryStringParameters'] or {}
        self.data = event['body']


def api(cors_origins=[]):
    def innerdec(f):
        @wraps(f)
        def wrapper(event, _):
            request = Request(event)
            try:
                status, body, response_headers = f(request)
            except Exception as ex:
                traceback.print_exc()
                status = 500
                body = str(ex)
                response_headers = {
                    'Content-Type': 'text/plain'
                }

            if isinstance(body, bytes):
                body = b64encode(body).decode()
                encoded = True
            else:
                encoded = False

            origin = request.headers.get('origin')
            if origin is not None and origin in cors_origins:
                response_headers.update({
                    'access-control-allow-origin': '*',
                    'access-control-allow-methods': 'HEAD,GET,POST',
                    'access-control-allow-headers': '*',
                    'access-control-max-age': 86400
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
