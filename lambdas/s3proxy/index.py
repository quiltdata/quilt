"""
Python implementation of the s3 proxy from quilt/s3-proxy/nginx.conf
"""
import urllib.parse

import requests

from t4_lambda_shared.decorator import api

session = requests.Session()


@api(custom_options=True)
def lambda_handler(request):
    """
    Forward the request to S3.
    """
    cors_headers = {
        'access-control-allow-headers': request.headers.get('access-control-request-headers', ''),
        'access-control-allow-methods': request.headers.get('access-control-request-method', ''),
        'access-control-allow-origin': '*',
        'access-control-max-age': '3000',
        'access-control-expose-headers': ', '.join([
            'Content-Length',
            'Content-Range',
            'ETag',
            'x-amz-bucket-region',
            'x-amz-delete-marker',
            'x-amz-request-id',
            'x-amz-version-id',
            'x-amz-storage-class',
        ])
    }

    parts = request.pathParameters['proxy'].split('/', 2)
    if len(parts) == 2:
        s3_region, s3_bucket = parts
        s3_path = ''
    elif len(parts) == 3:
        s3_region, s3_bucket, s3_path = parts
    else:
        return (
            requests.codes.bad_request,
            'Expected region/bucket/path',
            {'content-type': 'text/plain', **cors_headers}
        )

    if request.method == 'OPTIONS':
        return requests.codes.ok, '', cors_headers

    if s3_region == '-':
        s3_host = f'{s3_bucket}.s3.amazonaws.com'
    else:
        s3_host = f'{s3_bucket}.s3.{s3_region}.amazonaws.com'

    url = urllib.parse.urlunparse(
        ('https', s3_host, '/' + urllib.parse.quote(s3_path), None, urllib.parse.urlencode(request.args), None)
    )

    request_headers = dict(request.headers)
    request_headers.pop('host', None)  # Correct host header will come from the URL.
    request_headers.pop('connection', None)  # Let requests handle keep-alive, etc.

    response = session.request(
        method=request.method,
        url=url,
        data=request.data,
        headers=request_headers,
    )

    response_headers = response.headers.copy()  # It's a case-insensitive dict, not a regular dict.
    response_headers.update(cors_headers)

    # Drop headers that will get added automatically, so we don't have duplicates.
    response_headers.pop('date', None)
    response_headers.pop('server', None)

    # Add a default content type
    response_headers.setdefault('content-type', 'application/octet-stream')

    return response.status_code, response.content, response_headers
