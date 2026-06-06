import base64
import http.server
import importlib.util
import io
import runpy
import sys
import types
from pathlib import Path
from unittest.mock import Mock

import pytest

RUN_LAMBDA_PATH = Path(__file__).resolve().parents[1] / "run_lambda.py"


@pytest.fixture
def run_lambda_module(monkeypatch):
    fake_index = types.ModuleType("index")
    fake_index.lambda_handler = lambda event, context: None
    monkeypatch.setitem(sys.modules, "index", fake_index)

    spec = importlib.util.spec_from_file_location("run_lambda_under_test", RUN_LAMBDA_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class RecordingHandler:
    def __init__(self, *, path, command="GET", headers=None):
        self.path = path
        self.command = command
        self.headers = headers or {}
        self.wfile = io.BytesIO()
        self.status_code = None
        self.sent_headers = []
        self.ended = False

    def send_response(self, code):
        self.status_code = code

    def send_header(self, name, value):
        self.sent_headers.append((name, value))

    def end_headers(self):
        self.ended = True


def test_handle_request_translates_event_and_decodes_binary_response(run_lambda_module):
    handler = RecordingHandler(
        path="/lambda/hello%20world?foo=bar&empty=",
        command="POST",
        headers={"X-Test": "Value", "Content-Type": "application/octet-stream"},
    )
    lambda_handler = Mock(
        return_value={
            "statusCode": 201,
            "headers": {"Content-Type": "application/octet-stream"},
            "body": base64.b64encode(b"abc").decode(),
            "isBase64Encoded": True,
        }
    )
    run_lambda_module.lambda_handler = lambda_handler

    run_lambda_module.Handler._handle_request(handler, b"payload")

    lambda_handler.assert_called_once_with(
        {
            "httpMethod": "POST",
            "path": "/lambda/hello world",
            "pathParameters": {"proxy": "hello world"},
            "queryStringParameters": {"foo": "bar", "empty": ""},
            "headers": {"x-test": "Value", "content-type": "application/octet-stream"},
            "body": base64.b64encode(b"payload"),
            "isBase64Encoded": True,
        },
        None,
    )
    assert handler.status_code == 201
    assert ("Content-Type", "application/octet-stream") in handler.sent_headers
    assert ("Content-Length", "3") in handler.sent_headers
    assert handler.ended is True
    assert handler.wfile.getvalue() == b"abc"


def test_handle_request_writes_text_body_for_exact_lambda_path(run_lambda_module):
    handler = RecordingHandler(path="/lambda", headers={"X-Test": "Value"})
    lambda_handler = Mock(
        return_value={
            "statusCode": 200,
            "headers": {"Content-Type": "text/plain"},
            "body": "hello",
        }
    )
    run_lambda_module.lambda_handler = lambda_handler

    run_lambda_module.Handler._handle_request(handler, None)

    lambda_handler.assert_called_once_with(
        {
            "httpMethod": "GET",
            "path": "/lambda",
            "pathParameters": {"proxy": ""},
            "queryStringParameters": None,
            "headers": {"x-test": "Value"},
            "body": base64.b64encode(b""),
            "isBase64Encoded": True,
        },
        None,
    )
    assert handler.status_code == 200
    assert handler.wfile.getvalue() == b"hello"
    assert ("Content-Length", "5") in handler.sent_headers


def test_handle_request_returns_404_outside_lambda_path(run_lambda_module):
    handler = RecordingHandler(path="/nope")
    lambda_handler = Mock()
    run_lambda_module.lambda_handler = lambda_handler

    run_lambda_module.Handler._handle_request(handler, None)

    lambda_handler.assert_not_called()
    assert handler.status_code == 404
    assert ("Content-Type", "text/plain") in handler.sent_headers
    assert handler.wfile.getvalue() == b"Not Found"


@pytest.mark.parametrize("method_name", ["do_GET", "do_OPTIONS"])
def test_simple_http_methods_delegate_without_body(run_lambda_module, method_name):
    handler = types.SimpleNamespace(_handle_request=Mock())

    getattr(run_lambda_module.Handler, method_name)(handler)

    handler._handle_request.assert_called_once_with(None)


def test_post_reads_declared_body_length(run_lambda_module):
    handler = types.SimpleNamespace(
        headers={"Content-Length": "4"},
        rfile=io.BytesIO(b"payload"),
        _handle_request=Mock(),
    )

    run_lambda_module.Handler.do_POST(handler)

    handler._handle_request.assert_called_once_with(b"payl")


def test_main_rejects_extra_args(run_lambda_module, capsys):
    result = run_lambda_module.main(["run_lambda.py", "extra"])

    captured = capsys.readouterr()
    assert result == 1
    assert "Usage:" in captured.err


def test_main_starts_server(run_lambda_module, capsys):
    class StopServing(Exception):
        pass

    server = Mock()
    server.serve_forever.side_effect = StopServing
    http_server = Mock(return_value=server)
    run_lambda_module.HTTPServer = http_server

    with pytest.raises(StopServing):
        run_lambda_module.main(["run_lambda.py"])

    captured = capsys.readouterr()
    http_server.assert_called_once_with(("127.0.0.1", run_lambda_module.PORT), run_lambda_module.Handler)
    assert "Running on http://127.0.0.1:8080/lambda" in captured.out
    server.serve_forever.assert_called_once_with()


def test_script_entrypoint_calls_main_via_sys_exit(monkeypatch):
    fake_index = types.ModuleType("index")
    fake_index.lambda_handler = lambda event, context: None
    monkeypatch.setitem(sys.modules, "index", fake_index)

    server = Mock()
    http_server = Mock(return_value=server)
    monkeypatch.setattr(http.server, "HTTPServer", http_server)
    monkeypatch.setattr(sys, "argv", [str(RUN_LAMBDA_PATH)])

    with pytest.raises(SystemExit) as exc_info:
        runpy.run_path(str(RUN_LAMBDA_PATH), run_name="__main__")

    assert exc_info.value.code is None
    http_server.assert_called_once()
    server.serve_forever.assert_called_once_with()
