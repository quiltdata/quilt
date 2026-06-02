#!/usr/bin/env python3
"""
HTTP server that wraps a Lambda handler for local subprocess execution.

Usage:
    uv run --project lambdas/preview/ python lambda_runner.py --module t4_lambda_preview --port 0

The server converts HTTP requests to AWS Lambda event format, calls the handler,
and returns the response. Prints "LAMBDA_READY port=<N>" to stdout once listening.
"""

from __future__ import annotations

import argparse
import importlib
import sys
import types
from base64 import b64decode, b64encode
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qsl, unquote, urlparse

LAMBDA_PATH = "/lambda"

# Default timeout for local lambda execution (seconds)
_LOCAL_TIMEOUT_MS = 30_000


class _MockLambdaContext:
    """Minimal mock of the AWS Lambda context object for local execution."""

    def get_remaining_time_in_millis(self) -> int:
        return _LOCAL_TIMEOUT_MS


_mock_context = _MockLambdaContext()


def _patch_url_validation(module: types.ModuleType, proxy_origin: str):
    """
    Monkey-patch URL validation functions to accept local S3 proxy URLs.

    Production lambdas reject non-S3 URLs. In local mode, URLs point at
    http://localhost:<port>/__s3proxy/... which needs to be accepted.
    """
    if not proxy_origin:
        return

    parsed_origin = urlparse(proxy_origin)

    def _is_local_proxy_url(url: str) -> bool:
        parsed = urlparse(url, allow_fragments=False)
        return (
            parsed.scheme in ("http", "https")
            and parsed.hostname in ("localhost", "127.0.0.1", "::1")
            and parsed.port == parsed_origin.port
        )

    # Preview lambda: _is_valid_source_url
    if hasattr(module, "_is_valid_source_url"):
        original = module._is_valid_source_url

        def patched_is_valid_source_url(url: str) -> bool:
            return _is_local_proxy_url(url) or original(url)

        module._is_valid_source_url = patched_is_valid_source_url

    # Tabular preview lambda: is_s3_url
    if hasattr(module, "is_s3_url"):
        original = module.is_s3_url

        def patched_is_s3_url(url: str) -> bool:
            return _is_local_proxy_url(url) or original(url)

        module.is_s3_url = patched_is_s3_url


def _load_handler(module_name: str, proxy_origin: str):
    module = importlib.import_module(module_name)
    _patch_url_validation(module, proxy_origin)
    handler = getattr(module, "lambda_handler", None)
    if handler is None:
        raise AttributeError(f"{module_name} has no lambda_handler")
    return handler


class LambdaHandler(BaseHTTPRequestHandler):
    lambda_handler: staticmethod = None  # type: ignore[assignment]

    def log_message(self, format, *args):
        # Route access logs to stderr (parent reads and prefixes them)
        sys.stderr.write(f"{self.address_string()} - {format % args}\n")
        sys.stderr.flush()

    def _handle_request(self, req_body: bytes | None):
        parsed_url = urlparse(self.path)
        path = unquote(parsed_url.path)

        if path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
            return

        if path == LAMBDA_PATH or path.startswith(LAMBDA_PATH + "/"):
            query = dict(parse_qsl(parsed_url.query, keep_blank_values=True))
            headers = {k.lower(): v for k, v in self.headers.items()}

            args = {
                "httpMethod": self.command,
                "path": path,
                "pathParameters": {"proxy": path[len(LAMBDA_PATH) + 1 :]},
                "queryStringParameters": query or None,
                "headers": headers or None,
                "body": b64encode(req_body or b"").decode(),
                "isBase64Encoded": True,
            }

            result = self.lambda_handler(args, _mock_context)

            code = result["statusCode"]
            resp_headers = result.get("headers", {})
            body = result.get("body", "")
            encoded = result.get("isBase64Encoded", False)

            if encoded:
                body = b64decode(body)
            elif isinstance(body, (bytes, memoryview)):
                body = bytes(body)
            else:
                body = body.encode()

            resp_headers["Content-Length"] = str(len(body))

            self.send_response(code)
            for name, value in resp_headers.items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")

    def do_GET(self):
        self._handle_request(None)

    def do_POST(self):
        size = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(size)
        self._handle_request(body)

    def do_OPTIONS(self):
        self._handle_request(None)


def main():
    parser = argparse.ArgumentParser(description="Lambda subprocess runner")
    parser.add_argument("--module", required=True, help="Python module with lambda_handler (e.g., t4_lambda_preview)")
    parser.add_argument("--port", type=int, default=0, help="Port to listen on (0 = OS-assigned)")
    parser.add_argument(
        "--s3-proxy-origin", default="", help="Local S3 proxy origin to allow (e.g., http://localhost:3000/__s3proxy)"
    )
    args = parser.parse_args()

    handler = _load_handler(args.module, args.s3_proxy_origin)
    LambdaHandler.lambda_handler = staticmethod(handler)

    server = HTTPServer(("127.0.0.1", args.port), LambdaHandler)
    actual_port = server.server_address[1]

    # Signal readiness to the parent process
    sys.stdout.write(f"LAMBDA_READY port={actual_port}\n")
    sys.stdout.flush()

    server.serve_forever()


if __name__ == "__main__":
    main()
