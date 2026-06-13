import asyncio
import base64
import builtins
import importlib
import io
import os
import signal
import subprocess
import sys
import sysconfig
import types
from pathlib import Path

import pytest

from quilt3_local import lambda_runner, lambda_subprocess
from scripts import run_local_catalog


class _AsyncLineStream:
    def __init__(self, lines):
        self._lines = list(lines)

    async def readline(self):
        if self._lines:
            return self._lines.pop(0)
        return b""


class _FakeAsyncProcess:
    def __init__(self, *, stdout_lines=(), stderr_lines=(), returncode=None):
        self.stdout = _AsyncLineStream(stdout_lines)
        self.stderr = _AsyncLineStream(stderr_lines)
        self.returncode = returncode
        self.signals = []
        self.killed = False

    async def wait(self):
        if self.returncode is None:
            self.returncode = 0
        return self.returncode

    def send_signal(self, sig):
        self.signals.append(sig)

    def kill(self):
        self.killed = True
        self.returncode = -9


class _AsyncCloseTracker:
    def __init__(self):
        self.closed = False

    async def close(self):
        self.closed = True


def _make_http_handler(
    *,
    path: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    lambda_handler=None,
    s3_proxy_origin: str = "",
):
    handler = object.__new__(lambda_runner.LambdaHandler)
    state = {"status": None, "headers": []}
    handler.command = method
    handler.path = path
    handler.headers = headers or {}
    handler.wfile = io.BytesIO()
    handler.lambda_handler = lambda_handler or (lambda _event, _context: None)
    handler.s3_proxy_origin = s3_proxy_origin
    handler.send_response = lambda code: state.__setitem__("status", code)
    handler.send_header = lambda name, value: state["headers"].append((name, value))
    handler.end_headers = lambda: None
    return handler, state


def _request_asgi_http(app, path: str):
    messages = []
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        messages.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": [],
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "root_path": "",
        "app": app,
    }

    asyncio.run(app(scope, receive, send))
    start = next(message for message in messages if message["type"] == "http.response.start")
    body = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return start["status"], body


def _request_asgi_websocket(app, path: str):
    messages = []
    state = {"phase": 0}

    async def receive():
        if state["phase"] == 0:
            state["phase"] = 1
            return {"type": "websocket.connect"}
        return {"type": "websocket.disconnect", "code": 1000}

    async def send(message):
        messages.append(message)

    scope = {
        "type": "websocket",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "scheme": "ws",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": [(b"host", b"testserver")],
        "subprotocols": [],
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "root_path": "",
        "app": app,
    }

    asyncio.run(app(scope, receive, send))
    return messages


def _load_voila_proxy_with_fakes(monkeypatch):
    asgiproxy_pkg = types.ModuleType("asgiproxy")
    config_mod = types.ModuleType("asgiproxy.config")
    context_mod = types.ModuleType("asgiproxy.context")
    simple_proxy_mod = types.ModuleType("asgiproxy.simple_proxy")

    class DummyBaseURLProxyConfigMixin:
        pass

    class DummyProxyConfig:
        pass

    class DummyProxyContext:
        def __init__(self, config):
            self.config = config

        async def close(self):
            return None

    def make_simple_proxy_app(_proxy_context):
        async def proxy_app(scope, receive, send):
            if scope["type"] == "http":
                await send({"type": "http.response.start", "status": 207, "headers": []})
                await send({"type": "http.response.body", "body": b"proxied"})
                return None
            if scope["type"] == "websocket":
                await send({"type": "websocket.accept"})
                await send({"type": "websocket.close", "code": 1000})
                return None
            raise NotImplementedError(scope["type"])

        return proxy_app

    config_mod.BaseURLProxyConfigMixin = DummyBaseURLProxyConfigMixin
    config_mod.ProxyConfig = DummyProxyConfig
    context_mod.ProxyContext = DummyProxyContext
    simple_proxy_mod.make_simple_proxy_app = make_simple_proxy_app

    monkeypatch.setitem(sys.modules, "asgiproxy", asgiproxy_pkg)
    monkeypatch.setitem(sys.modules, "asgiproxy.config", config_mod)
    monkeypatch.setitem(sys.modules, "asgiproxy.context", context_mod)
    monkeypatch.setitem(sys.modules, "asgiproxy.simple_proxy", simple_proxy_mod)
    sys.modules.pop("quilt3_local.voila_proxy", None)
    import quilt3_local.voila_proxy as voila_proxy

    return importlib.reload(voila_proxy)


def _reload_local_main(monkeypatch, tmp_path, *, catalog_url: str | None = None):
    bundle_dir = tmp_path / "bundle"
    bundle_dir.mkdir(exist_ok=True)
    (bundle_dir / "index.html").write_text("<html>bundle</html>")
    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("QUILT_LOCAL_ORIGIN", "http://testserver")
    monkeypatch.setenv("QUILT_CATALOG_BUNDLE", str(bundle_dir))
    if catalog_url is None:
        monkeypatch.delenv("QUILT_CATALOG_URL", raising=False)
    else:
        monkeypatch.setenv("QUILT_CATALOG_URL", catalog_url)

    import quilt3_local.main as local_main

    return importlib.reload(local_main)


def test_lambda_runner_patches_loopback_url_validation():
    module = types.SimpleNamespace(_is_valid_source_url=lambda url: url == "https://example.com/object")

    lambda_runner._patch_url_validation(module, "http://127.0.0.1:3000/__s3proxy")

    assert module._is_valid_source_url("https://example.com/object") is True
    assert module._is_valid_source_url("http://127.0.0.1:3000/__s3proxy/demo-bucket/file.txt") is True
    assert module._is_valid_source_url("http://127.0.0.1:4000/__s3proxy/demo-bucket/file.txt") is False


def test_lambda_runner_rewrites_local_presigned_s3_urls():
    url = (
        "https://demo-bucket.s3.amazonaws.com/preview/text/short.txt"
        "?X-Amz-Credential=LOCALMODEACCESSKEY%2F20240613%2Fus-east-1%2Fs3%2Faws4_request"
    )

    rewritten = lambda_runner._rewrite_local_presigned_url(url, "http://127.0.0.1:3000/__s3proxy")

    assert rewritten.startswith(
        "http://127.0.0.1:3000/__s3proxy/demo-bucket.s3.amazonaws.com/preview/text/short.txt?"
    )
    assert "LOCALMODEACCESSKEY" in rewritten


def test_lambda_handler_serves_health_and_not_found():
    health_handler, health_state = _make_http_handler(path="/health")
    health_handler._handle_request(None)

    assert health_state["status"] == 200
    assert dict(health_state["headers"])["Content-Type"] == "text/plain"
    assert health_handler.wfile.getvalue() == b"ok"

    missing_handler, missing_state = _make_http_handler(path="/missing")
    missing_handler._handle_request(None)

    assert missing_state["status"] == 404
    assert missing_handler.wfile.getvalue() == b"Not Found"


def test_lambda_handler_rewrites_query_and_decodes_binary_response():
    seen = {}
    request_body = b'{"hello": "world"}'
    presigned = (
        "https://demo-bucket.s3.amazonaws.com/preview/text/short.txt"
        "?X-Amz-Credential=LOCALMODEACCESSKEY%2F20240613%2Fus-east-1%2Fs3%2Faws4_request"
    )

    def fake_lambda(event, context):
        seen["event"] = event
        seen["remaining_ms"] = context.get_remaining_time_in_millis()
        return {
            "statusCode": 201,
            "headers": {"content-type": "application/octet-stream"},
            "body": base64.b64encode(b"preview-bytes").decode(),
            "isBase64Encoded": True,
        }

    handler, state = _make_http_handler(
        path=f"/lambda/render?url={presigned}&mode=full",
        method="POST",
        headers={"Content-Type": "application/json", "X-Test": "true"},
        lambda_handler=fake_lambda,
        s3_proxy_origin="http://127.0.0.1:3000/__s3proxy",
    )
    handler._handle_request(request_body)

    assert state["status"] == 201
    assert handler.wfile.getvalue() == b"preview-bytes"
    response_headers = dict(state["headers"])
    assert response_headers["content-type"] == "application/octet-stream"
    assert response_headers["Content-Length"] == str(len(b"preview-bytes"))
    assert seen["remaining_ms"] == 30_000
    assert seen["event"]["httpMethod"] == "POST"
    assert seen["event"]["path"] == "/lambda/render"
    assert seen["event"]["pathParameters"] == {"proxy": "render"}
    assert seen["event"]["headers"]["content-type"] == "application/json"
    assert seen["event"]["queryStringParameters"]["mode"] == "full"
    assert seen["event"]["queryStringParameters"]["url"].startswith(
        "http://127.0.0.1:3000/__s3proxy/demo-bucket.s3.amazonaws.com/preview/text/short.txt?"
    )
    assert base64.b64decode(seen["event"]["body"]) == request_body


def test_lambda_runner_main_loads_handler_and_announces_ready(monkeypatch, capsys):
    calls = {}

    class FakeServer:
        def __init__(self, address, handler_cls):
            calls["address"] = address
            calls["handler_cls"] = handler_cls
            self.server_address = ("127.0.0.1", 43123)

        def serve_forever(self):
            calls["served"] = True

    def fake_load_handler(module_name, proxy_origin):
        calls["module_name"] = module_name
        calls["proxy_origin"] = proxy_origin
        return lambda _event, _context: {"statusCode": 200, "body": "ok"}

    monkeypatch.setattr(lambda_runner, "HTTPServer", FakeServer)
    monkeypatch.setattr(lambda_runner, "_load_handler", fake_load_handler)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "lambda_runner.py",
            "--module",
            "t4_lambda_preview",
            "--port",
            "0",
            "--s3-proxy-origin",
            "http://127.0.0.1:3000/__s3proxy",
        ],
    )

    lambda_runner.main()

    captured = capsys.readouterr()
    assert captured.out == "LAMBDA_READY port=43123\n"
    assert calls["module_name"] == "t4_lambda_preview"
    assert calls["proxy_origin"] == "http://127.0.0.1:3000/__s3proxy"
    assert calls["address"] == ("127.0.0.1", 0)
    assert calls["handler_cls"] is lambda_runner.LambdaHandler
    assert calls["served"] is True
    assert lambda_runner.LambdaHandler.s3_proxy_origin == "http://127.0.0.1:3000/__s3proxy"


def test_lambda_process_start_reads_ready_signal_and_stop_terminates(monkeypatch, tmp_path):
    repo_root = tmp_path
    (repo_root / "lambdas" / "preview").mkdir(parents=True)
    process = _FakeAsyncProcess(stdout_lines=[b"noise\n", b"LAMBDA_READY port=41234\n"])
    spawned = {}

    async def fake_spawn(*cmd, **kwargs):
        spawned["cmd"] = cmd
        spawned["kwargs"] = kwargs
        return process

    monkeypatch.setattr(lambda_subprocess.asyncio, "create_subprocess_exec", fake_spawn)

    proc = lambda_subprocess.LambdaProcess(
        config=lambda_subprocess.LambdaConfig(
            name="preview",
            project_dir="lambdas/preview",
            module="t4_lambda_preview",
            python="3.12",
        ),
        repo_root=repo_root,
        s3_proxy_origin="http://127.0.0.1:3000/__s3proxy",
    )

    asyncio.run(proc.start())

    assert proc.port == 41234
    assert proc.is_running is True
    assert spawned["cmd"][:4] == (
        "uv",
        "run",
        "--project",
        str(repo_root / "lambdas" / "preview"),
    )
    assert "--python" in spawned["cmd"]
    assert spawned["kwargs"]["stdout"] == asyncio.subprocess.PIPE
    assert spawned["kwargs"]["stderr"] == asyncio.subprocess.PIPE

    asyncio.run(proc.stop())

    assert process.signals == [signal.SIGTERM]
    assert proc.port is None
    assert proc.is_running is False


def test_lambda_process_read_ready_signal_errors_when_process_exits_early(tmp_path):
    proc = lambda_subprocess.LambdaProcess(
        config=lambda_subprocess.LambdaConfig(name="preview", project_dir="lambdas/preview", module="demo"),
        repo_root=tmp_path,
        s3_proxy_origin="http://127.0.0.1:3000/__s3proxy",
    )
    proc._process = _FakeAsyncProcess(stdout_lines=[])

    with pytest.raises(RuntimeError, match="Process exited before signaling readiness"):
        asyncio.run(proc._read_ready_signal())


def test_detect_repo_root_prefers_env_override(monkeypatch, tmp_path):
    monkeypatch.setenv("QUILT_REPO_ROOT", str(tmp_path))

    assert lambda_subprocess.detect_repo_root() == tmp_path.resolve()


def test_run_local_catalog_detects_built_bundle_and_fallbacks(monkeypatch, tmp_path):
    repo_root = tmp_path / "repo"
    build_dir = repo_root / "catalog" / "build"
    build_dir.mkdir(parents=True)
    (build_dir / "index.html").write_text('<script src="/app.abc123.js"></script>')

    purelib = tmp_path / "site-packages"
    package_bundle = purelib / "quilt3_local" / "catalog_bundle"
    package_bundle.mkdir(parents=True)
    (package_bundle / "index.html").write_text('<script src="/app.def456.js"></script>')

    import quilt3_local.lambda_subprocess as local_lambda_subprocess

    monkeypatch.setattr(local_lambda_subprocess, "detect_repo_root", lambda: repo_root)
    monkeypatch.setattr(sysconfig, "get_paths", lambda: {"purelib": str(purelib)})

    assert run_local_catalog._is_built_bundle(build_dir) is True
    assert run_local_catalog._find_catalog_bundle() == build_dir

    (build_dir / "index.html").write_text("<html>unbuilt</html>")
    assert run_local_catalog._find_catalog_bundle() == package_bundle


def test_run_local_catalog_free_port_terminates_listeners(monkeypatch):
    kills = []

    monkeypatch.setattr(
        run_local_catalog.subprocess,
        "run",
        lambda *args, **kwargs: types.SimpleNamespace(stdout="101\n202\n303\n"),
    )
    monkeypatch.setattr(run_local_catalog.os, "getpid", lambda: 202)
    monkeypatch.setattr(run_local_catalog.os, "kill", lambda pid, sig: kills.append((pid, sig)))
    monkeypatch.setattr(run_local_catalog.time, "sleep", lambda _seconds: None)

    run_local_catalog._free_port(3000)

    assert kills == [
        (101, signal.SIGTERM),
        (303, signal.SIGTERM),
        (101, signal.SIGKILL),
        (303, signal.SIGKILL),
    ]


def test_run_local_catalog_main_sets_env_and_launches_uvicorn(monkeypatch, tmp_path, capsys):
    staged = []
    freed_ports = []
    uvicorn_calls = []
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    data_dir = tmp_path / "data"

    monkeypatch.delenv("QUILT_CATALOG_BUNDLE", raising=False)
    monkeypatch.delenv("QUILT_LOCAL_ORIGIN", raising=False)
    monkeypatch.setattr(run_local_catalog, "_stage", lambda path, bucket: staged.append((path, bucket)))
    monkeypatch.setattr(run_local_catalog, "_free_port", lambda port: freed_ports.append(port))
    monkeypatch.setattr(run_local_catalog, "_find_catalog_bundle", lambda: bundle)
    monkeypatch.setitem(
        sys.modules,
        "uvicorn",
        types.SimpleNamespace(run=lambda *args, **kwargs: uvicorn_calls.append((args, kwargs))),
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "run_local_catalog.py",
            "--host",
            "127.0.0.1",
            "--port",
            "4010",
            "--data-dir",
            str(data_dir),
            "--bucket",
            "demo-bucket",
            "--no-reload",
        ],
    )

    rc = run_local_catalog.main()

    captured = capsys.readouterr()
    assert rc == 0
    assert staged == [(data_dir.resolve(), "demo-bucket")]
    assert freed_ports == [4010]
    assert os.environ["QUILT_LOCAL_OBJECT_BACKEND"] == "filesystem"
    assert os.environ["QUILT_LOCAL_DATA_DIR"] == str(data_dir.resolve())
    assert os.environ["QUILT_LOCAL_ORIGIN"] == "http://127.0.0.1:4010"
    assert os.environ["QUILT_CATALOG_BUNDLE"] == str(bundle)
    assert uvicorn_calls == [
        (
            ("quilt3_local.main:app",),
            {"host": "127.0.0.1", "port": 4010, "reload": False, "log_level": "info"},
        )
    ]
    assert f"Serving catalog bundle: {bundle}" in captured.out
    assert "LOCAL catalog (filesystem mode) → http://127.0.0.1:4010/b/demo-bucket" in captured.out


def test_run_local_catalog_main_reports_missing_uvicorn(monkeypatch, tmp_path, capsys):
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "uvicorn":
            raise ModuleNotFoundError("No module named 'uvicorn'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    monkeypatch.delenv("QUILT_CATALOG_BUNDLE", raising=False)
    monkeypatch.setattr(run_local_catalog, "_find_catalog_bundle", lambda: None)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "run_local_catalog.py",
            "--data-dir",
            str(tmp_path / "data"),
            "--bucket",
            "demo-bucket",
            "--no-stage",
            "--keep-existing",
        ],
    )

    rc = run_local_catalog.main()

    captured = capsys.readouterr()
    assert rc == 1
    assert "WARNING: no built catalog bundle found" in captured.out
    assert "Run with the catalog extra: uv run --extra catalog python -m scripts.run_local_catalog" in captured.out


def test_voila_kernel_translate_maps_query_params():
    import quilt3_local.voila_kernel as voila_kernel

    env = voila_kernel._translate(
        {
            "pkg_bucket": ["demo-bucket"],
            "pkg_name": [b"local/demo"],
            "pkg_top_hash": ["a" * 64],
            "access_key": ["AKIA-LOCAL"],
            "secret_key": ["secret-local"],
            "session_token": ["token-local"],
        }
    )

    assert env == {
        "QUILT_PKG_BUCKET": "demo-bucket",
        "QUILT_PKG_NAME": "local/demo",
        "QUILT_PKG_TOP_HASH": "a" * 64,
        "AWS_ACCESS_KEY_ID": "AKIA-LOCAL",
        "AWS_SECRET_ACCESS_KEY": "secret-local",
        "AWS_SESSION_TOKEN": "token-local",
    }


def test_voila_kernel_fallback_class_raises_without_optional_extra():
    import quilt3_local.voila_kernel as voila_kernel

    if voila_kernel._BaseKernelManager is None:
        with pytest.raises(RuntimeError, match="local-voila"):
            voila_kernel.QuiltKernelManager()


def test_voila_proxy_health_proxy_and_websocket_paths(monkeypatch):
    voila_proxy = _load_voila_proxy_with_fakes(monkeypatch)

    ready_manager = types.SimpleNamespace(is_ready=lambda: True, get_port=lambda: 8123)
    app, _context = voila_proxy.make_voila_proxy_app(lambda: ready_manager)

    health_status, health_body = _request_asgi_http(app, voila_proxy.HEALTH_PATH)
    proxied_status, proxied_body = _request_asgi_http(app, "/__reg/voila/voila/render/demo.ipynb")
    websocket_messages = _request_asgi_websocket(app, "/__reg/voila/api/kernels/k-1/channels")

    assert health_status == 200
    assert b'"status":"ok"' in health_body
    assert proxied_status == 207
    assert proxied_body == b"proxied"
    assert any(message["type"] == "websocket.accept" for message in websocket_messages)


def test_voila_proxy_rejects_requests_until_manager_ready(monkeypatch):
    voila_proxy = _load_voila_proxy_with_fakes(monkeypatch)

    app, _context = voila_proxy.make_voila_proxy_app(lambda: types.SimpleNamespace(is_ready=lambda: False, get_port=lambda: None))
    http_status, http_body = _request_asgi_http(app, "/__reg/voila/voila/render/demo.ipynb")
    websocket_messages = _request_asgi_websocket(app, "/__reg/voila/api/kernels/k-1/channels")

    assert http_status == 404
    assert voila_proxy._NOT_AVAILABLE_DETAIL.encode() in http_body
    assert websocket_messages == [{"type": "websocket.close", "code": 1011}]


def test_voila_proxy_config_uses_live_manager_port(monkeypatch):
    voila_proxy = _load_voila_proxy_with_fakes(monkeypatch)

    config = voila_proxy.VoilaProxyConfig(get_manager=lambda: types.SimpleNamespace(get_port=lambda: 4242))

    assert config.get_upstream_url(scope={"path": "/__reg/voila/voila/render/demo.ipynb"}) == (
        "http://127.0.0.1:4242/__reg/voila/voila/render/demo.ipynb"
    )


def test_local_main_spa_falls_back_to_index_and_config_js(monkeypatch, tmp_path):
    local_main = _reload_local_main(monkeypatch, tmp_path)
    bundle_dir = Path(local_main.CATALOG_BUNDLE)
    (bundle_dir / "asset.js").write_text("console.log('asset');")

    spa = local_main.SPA(directory=bundle_dir)
    missing_path, missing_stat = spa.lookup_path("missing.js")
    asset_path, asset_stat = spa.lookup_path("asset.js")
    config_js = local_main.config_js()

    assert Path(missing_path).name == "index.html"
    assert missing_stat is not None
    assert Path(asset_path).name == "asset.js"
    assert asset_stat is not None
    assert config_js.media_type == "application/javascript"
    assert "window.QUILT_CATALOG_CONFIG" in config_js.body.decode()


def test_local_main_lifespan_starts_and_stops_managers(monkeypatch, tmp_path):
    local_main = _reload_local_main(monkeypatch, tmp_path)
    lambda_manager = types.SimpleNamespace(started=False, stopped=False)
    voila_manager = types.SimpleNamespace(started=False, stopped=False)
    lambda_close = {"called": False}

    async def lambda_start_all():
        lambda_manager.started = True

    async def lambda_stop_all():
        lambda_manager.stopped = True

    async def voila_start_all():
        voila_manager.started = True

    async def voila_stop_all():
        voila_manager.stopped = True

    async def close_lambda_client():
        lambda_close["called"] = True

    lambda_manager.start_all = lambda_start_all
    lambda_manager.stop_all = lambda_stop_all
    voila_manager.start_all = voila_start_all
    voila_manager.stop_all = voila_stop_all

    proxy_context = _AsyncCloseTracker()
    voila_proxy_context = _AsyncCloseTracker()
    monkeypatch.setattr(local_main, "detect_repo_root", lambda: tmp_path)
    monkeypatch.setattr(local_main, "local_origin", lambda: "http://127.0.0.1:3000")
    monkeypatch.setattr(local_main, "LambdaManager", lambda **kwargs: lambda_manager)
    monkeypatch.setattr(local_main, "voila_available", lambda: True)
    monkeypatch.setattr(local_main, "voila_notebook_dir", lambda: tmp_path / "notebooks")
    monkeypatch.setattr(local_main, "VoilaManager", lambda **kwargs: voila_manager)
    monkeypatch.setattr(local_main, "close_lambda_client", close_lambda_client)
    local_main.proxy_context = proxy_context
    local_main.voila_proxy_context = voila_proxy_context

    async def exercise_lifespan():
        app = types.SimpleNamespace(state=types.SimpleNamespace())
        async with local_main.lifespan(app):
            assert app.state.lambda_manager is lambda_manager
            assert app.state.voila_manager is voila_manager
            assert local_main.lambdas.state.lambda_manager is lambda_manager

    asyncio.run(exercise_lifespan())

    assert lambda_manager.started is True
    assert lambda_manager.stopped is True
    assert voila_manager.started is True
    assert voila_manager.stopped is True
    assert lambda_close["called"] is True
    assert proxy_context.closed is True
    assert voila_proxy_context.closed is True


def test_local_main_run_exits_when_uvicorn_is_missing(monkeypatch, tmp_path, capsys):
    local_main = _reload_local_main(monkeypatch, tmp_path)
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "uvicorn":
            raise ImportError("missing")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    with pytest.raises(SystemExit) as exc:
        local_main.run()

    captured = capsys.readouterr()
    assert exc.value.code == 0
    assert "Please install uvicorn to run a development server." in captured.out