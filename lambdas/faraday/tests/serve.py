"""Local-only bridge for runner.html. Run with: uv run python tests/serve.py."""

import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory

from botocore.exceptions import ClientError, NoCredentialsError, NoRegionError
from pydantic import BaseModel, ConfigDict, Field

import quilt3
from quilt3.util import QuiltConflictException
from t4_lambda_faraday import DEFAULT_MODEL, SessionRef, lambda_handler
from t4_lambda_faraday.session import Session, encode

HTML = Path(__file__).with_name("runner.html")
DEFAULT_REGISTRY = "s3://protology"


class Selection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session: SessionRef
    path: str | None = None
    top_hash: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


def dispatch(path, body):
    if path == "/api/invoke":
        return lambda_handler(body, None)
    selected = Selection.model_validate(body)
    registry, name = selected.session.registry.rstrip("/"), selected.session.package
    if path == "/api/sessions":
        return {"packages": sorted(name for name in quilt3.list_packages(registry) if name.startswith("faraday/"))}
    with TemporaryDirectory(prefix="faraday-viewer-") as directory:
        if path == "/api/session":
            session = Session.load(registry, name, Path(directory))
            return {
                "session": {"registry": registry, "package": name, "top_hash": session.package.top_hash},
                "state": session.state,
                "messages": session.messages,
                "files": session.keys(),
                "agents": session.read("AGENTS.md"),
            }
        if path == "/api/file":
            if selected.path is None or selected.top_hash is None:
                raise ValueError("File reads require a path and package version")
            package = quilt3.Package.browse(name, registry=registry, top_hash=selected.top_hash)
            session = Session(registry, name, Path(directory), package)
            return {"path": selected.path, "text": session.read(selected.path)}
    raise ValueError("Unknown API route")


def error_response(error):
    if isinstance(error, QuiltConflictException):
        return 409, "The package changed or already exists. Load it before continuing."
    if isinstance(error, NoCredentialsError):
        return 401, "AWS credentials are unavailable. Configure AWS_PROFILE for the local server."
    if isinstance(error, NoRegionError):
        return 400, "Set AWS_DEFAULT_REGION for the local server."
    if isinstance(error, ClientError):
        code = error.response.get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "NoSuchBucket", "404"):
            return 404, "Package or file not found. Check the bucket and session name."
        if code in ("AccessDenied", "403"):
            return 403, "AWS denied access. Check the local server's credentials and bucket permissions."
        if code in ("ExpiredToken", "InvalidClientTokenId"):
            return 401, "AWS credentials have expired or are invalid. Refresh the server's AWS session."
    if isinstance(error, KeyError):
        return 404, "This package is missing a required session file."
    if isinstance(error, UnicodeError):
        return 400, "This file is not UTF-8 text."
    if isinstance(error, ValueError):
        return 400, "Invalid request or session file. Check the fields and the 512 KiB text-file limit."
    # SDK exceptions can contain request headers, so never return raw exception text.
    return 502, f"The operation failed ({type(error).__name__}). Check AWS and MCP configuration."


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, value, content_type="application/json"):
        data = value if isinstance(value, bytes) else json.dumps(value, default=encode).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'unsafe-inline'; "
            "style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'; base-uri 'none'",
        )
        self.end_headers()
        self.wfile.write(data)

    def local_request(self):
        port = self.server.server_port
        allowed = {f"127.0.0.1:{port}", f"localhost:{port}"}
        host = self.headers.get("Host")
        origin = self.headers.get("Origin")
        if host not in allowed or (origin is not None and origin != f"http://{host}"):
            self.respond(403, {"error": "Only same-origin localhost requests are accepted."})
            return False
        return True

    def do_GET(self):
        if not self.local_request():
            return
        if self.path in ("/", "/runner.html"):
            self.respond(200, HTML.read_bytes(), "text/html; charset=utf-8")
        elif self.path == "/api/config":
            self.respond(
                200,
                {
                    "registry": DEFAULT_REGISTRY,
                    "model": os.environ.get("FARADAY_MODEL_ID", DEFAULT_MODEL),
                    "region": os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("AWS_REGION"),
                    "mcp": bool(os.environ.get("FARADAY_MCP_URL")),
                },
            )
        else:
            self.respond(404, {"error": "Not found"})

    def do_POST(self):
        if not self.local_request():
            return
        # Reject cross-site forms and require a header browsers cannot send without CORS preflight.
        if self.headers.get("X-Faraday-Runner") != "1" or self.headers.get_content_type() != "application/json":
            self.respond(403, {"error": "Use the local Faraday runner."})
            return
        if self.path not in ("/api/invoke", "/api/session", "/api/sessions", "/api/file"):
            self.respond(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 512 * 1024:
                self.respond(413, {"error": "Request body must be between 1 byte and 512 KiB."})
                return
            body = json.loads(self.rfile.read(length))
            result = dispatch(self.path, body)
        except Exception as error:
            status, message = error_response(error)
            self.respond(status, {"error": message})
            return
        self.respond(200, result)


def make_server(port=8787):
    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()
    with make_server(args.port) as server:
        print(f"Faraday runner: http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
