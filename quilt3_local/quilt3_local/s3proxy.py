"""
Python implementation of the s3 proxy from quilt/s3-proxy/nginx.conf
"""
import urllib.parse

import aiohttp
import fastapi

s3proxy = fastapi.FastAPI()


@s3proxy.api_route("/{s3_region}/{s3_bucket}", methods=["GET", "HEAD", "POST", "PUT", "OPTIONS"])
@s3proxy.api_route("/{s3_region}/{s3_bucket}/{s3_path:path}", methods=["GET", "HEAD", "POST", "PUT", "OPTIONS"])
async def s3proxy_request(request: fastapi.Request, s3_region: str, s3_bucket: str, s3_path: str = ""):
    """
    Forward the request to S3.
    """
    cors_headers = {
        "access-control-allow-headers": request.headers.get("access-control-request-headers", ""),
        "access-control-allow-methods": request.headers.get("access-control-request-method", ""),
        "access-control-allow-origin": "*",
        "access-control-max-age": "3000",
        "access-control-expose-headers": ", ".join([
            "Content-Length",
            "Content-Range",
            "ETag",
            "x-amz-bucket-region",
            "x-amz-delete-marker",
            "x-amz-request-id",
            "x-amz-version-id",
            "x-amz-storage-class",
        ]),
    }

    req_body = await request.body()

    if request.method == "OPTIONS":
        return fastapi.Response(content="", status_code=200, headers=cors_headers)

    if s3_region == "-":
        s3_host = f"{s3_bucket}.s3.amazonaws.com"
    else:
        s3_host = f"{s3_bucket}.s3.{s3_region}.amazonaws.com"

    url = urllib.parse.urlunparse((
        "https",
        s3_host,
        "/" + urllib.parse.quote(s3_path),
        None,
        urllib.parse.urlencode(request.query_params),
        None,
    ))

    request_headers = dict(request.headers)
    request_headers.pop("host", None)  # Correct host header will come from the URL.
    request_headers.pop("connection", None)  # Let requests handle keep-alive, etc.

    async with aiohttp.ClientSession() as session:
        async with session.request(
            method=request.method,
            url=url,
            data=req_body,
            headers=request_headers,
        ) as response:
            response_headers = response.headers.copy()  # It's a case-insensitive dict, not a regular dict.
            response_body = await response.content.read()  # TODO: Use a StreamingResponse?

            response_headers.update(cors_headers)

            # Drop headers that will get added automatically, so we don't have duplicates.
            response_headers.pop("date", None)
            response_headers.pop("server", None)

            # Add a default content type
            response_headers.setdefault("content-type", "application/octet-stream")

            return fastapi.Response(
                content=response_body,
                status_code=response.status,
                headers=response_headers,
            )
