"""
Manages a single Voila subprocess for the local catalog.

Voila runs as a subprocess in the SAME environment as the parent backend -- the
one the operator synced with the opt-in ``local-voila`` extra. We deliberately do
NOT launch it via ``uv run --with voila`` (that would install Voila on demand and
defeat the install gate); availability is decided by ``voila_available()`` before
the manager is ever started. Unlike the lambdas, Voila does NOT emit a
"LAMBDA_READY port=" line, so readiness is determined by polling the upstream HTTP
landing page. The proxy bridges browser HTTP + WebSocket traffic to this process;
see voila_proxy.py.
"""

from __future__ import annotations

import asyncio
import importlib.util
import logging
import os
import signal
import socket
import sys
from dataclasses import dataclass, field
from pathlib import Path

import aiohttp

from . import settings

logger = logging.getLogger(__name__)

STARTUP_TIMEOUT = 30.0
STOP_GRACE_PERIOD = 5.0
_POLL_INTERVAL = 0.25

# How many times to re-pick a port and relaunch if Voila exits immediately
# (the symptom of losing the _pick_free_port TOCTOU race for the chosen port).
_PORT_RETRIES = 3

# Provided by the opt-in "local-voila" extra; kept in sync with pyproject.toml.
_KERNEL_MANAGER_CLASS = "quilt3_local.voila_kernel.QuiltKernelManager"

# Render-query keys that carry AWS credentials. These must never appear in a
# render URL — they are injected into the per-session kernel env instead.
_CREDENTIAL_PARAMS = frozenset({"access_key", "secret_key", "session_token"})


def voila_available() -> bool:
    """Whether interactive Voila can run: the opt-in flag AND the extra installed.

    This is the BINDING gate used by main.py to decide whether to start the
    manager and mount the proxy. It requires both that the operator opted in
    (settings.voila_enabled()) and that the "local-voila" extra is actually
    installed in this interpreter's env (the same env Voila is launched in).

    Uses importlib.util.find_spec (not a real import) so the parent uvicorn
    process stays light and avoids pulling tornado/ipykernel into the FastAPI
    event loop.
    """
    if not settings.voila_enabled():
        return False
    return importlib.util.find_spec("voila") is not None and importlib.util.find_spec("jupyter_server") is not None


def _pick_free_port() -> int:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]
    finally:
        sock.close()


@dataclass
class VoilaProcess:
    repo_root: Path
    notebook_dir: Path
    base_url: str
    port: int | None = field(default=None, init=False)
    _process: asyncio.subprocess.Process | None = field(default=None, init=False, repr=False)
    _stderr_task: asyncio.Task | None = field(default=None, init=False, repr=False)
    _stdout_task: asyncio.Task | None = field(default=None, init=False, repr=False)
    _ready: bool = field(default=False, init=False, repr=False)

    @property
    def is_running(self) -> bool:
        return self._process is not None and self._process.returncode is None

    def is_ready(self) -> bool:
        return self.is_running and self._ready

    def _build_env(self) -> dict[str, str]:
        env = dict(os.environ)
        env.update(settings.local_backend_env())
        env["QUILT_REPO_ROOT"] = str(self.repo_root)
        # Make quilt3_local.voila_kernel importable inside the voila env.
        api_python = str(self.repo_root / "api" / "python")
        existing = env.get("PYTHONPATH", "")
        env["PYTHONPATH"] = f"{api_python}{os.pathsep}{existing}" if existing else api_python
        return env

    async def start(self) -> None:
        if self.is_running:
            return

        if not self.notebook_dir.exists():
            self.notebook_dir.mkdir(parents=True, exist_ok=True)

        # _pick_free_port closes the probe socket before Voila binds, so there is
        # an unavoidable TOCTOU window where another process can claim the port.
        # Rather than try to hold the socket open across the handoff, retry with a
        # fresh port if Voila exits immediately (the symptom of a bind collision).
        for attempt in range(1, _PORT_RETRIES + 1):
            await self._start_once()
            if self.is_ready():
                return
            if attempt < _PORT_RETRIES:
                logger.warning(
                    "[voila] Startup failed (attempt %s/%s); retrying on a new port",
                    attempt,
                    _PORT_RETRIES,
                )

    async def _start_once(self) -> None:
        # Voila prints no readiness line; choose an explicit free port up front.
        self.port = _pick_free_port()
        self._ready = False

        # Launch Voila in the SAME interpreter/env as the parent uvicorn process
        # (the one the user synced with `uv sync --extra catalog --extra local-voila`).
        # We do NOT use `uv run --with voila ...`: that would install Voila on demand
        # and defeat the opt-in install gate. Availability is gated by voila_available()
        # (find_spec in this same env) before the manager is ever started, so reaching
        # start() means the extra is installed and the console script is on PATH next to
        # the interpreter; fall back to `python -m voila` if the script is missing.
        voila_bin = Path(sys.executable).with_name("voila")
        cmd: list[str] = [str(voila_bin)] if voila_bin.exists() else [sys.executable, "-m", "voila"]
        cmd += [
            "--no-browser",
            "--port",
            str(self.port),
            "--Voila.ip=127.0.0.1",
            f"--Voila.base_url={self.base_url}",
            f"--Voila.root_dir={self.notebook_dir}",
            "--ServerApp.token=",
            "--ServerApp.disable_check_xsrf=True",
            f"--VoilaConfiguration.multi_kernel_manager_class={_KERNEL_MANAGER_CLASS}",
            str(self.notebook_dir),
        ]

        logger.info("[voila] Starting on port %s: %s", self.port, " ".join(cmd))

        self._process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(self.notebook_dir),
            env=self._build_env(),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Forward child output in the background.
        self._stderr_task = asyncio.create_task(self._forward_stream(self._process.stderr, "stderr"))
        self._stdout_task = asyncio.create_task(self._forward_stream(self._process.stdout, "stdout"))

        try:
            await asyncio.wait_for(self._wait_ready(), STARTUP_TIMEOUT)
            self._ready = True
            logger.info("[voila] Ready on port %s", self.port)
        except asyncio.TimeoutError:
            logger.error("[voila] Startup timed out after %ss", STARTUP_TIMEOUT)
            await self.stop()
        except RuntimeError as e:
            logger.error("[voila] Startup failed: %s", e)
            await self.stop()

    async def _wait_ready(self) -> None:
        """Poll the upstream landing page until Voila answers (status < 500)."""
        url = f"http://127.0.0.1:{self.port}{self.base_url}"
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            while True:
                if self._process is not None and self._process.returncode is not None:
                    raise RuntimeError(f"Voila exited before becoming ready (code={self._process.returncode})")
                try:
                    async with session.get(url, allow_redirects=False) as resp:
                        if resp.status < 500:
                            return
                except (aiohttp.ClientError, asyncio.TimeoutError):
                    pass
                await asyncio.sleep(_POLL_INTERVAL)

    async def _forward_stream(self, stream: asyncio.StreamReader | None, label: str) -> None:
        if stream is None:
            return
        prefix = "[voila]"
        while True:
            line = await stream.readline()
            if not line:
                break
            sys.stderr.write(f"{prefix} ({label}) {line.decode(errors='replace')}")
            sys.stderr.flush()

    async def stop(self) -> None:
        for task_attr in ("_stderr_task", "_stdout_task"):
            task = getattr(self, task_attr)
            if task is not None and not task.done():
                task.cancel()
            setattr(self, task_attr, None)

        if self._process is None:
            self._ready = False
            self.port = None
            return

        if self._process.returncode is None:
            self._process.send_signal(signal.SIGTERM)
            try:
                await asyncio.wait_for(self._process.wait(), STOP_GRACE_PERIOD)
            except asyncio.TimeoutError:
                self._process.kill()
                await self._process.wait()

        self._process = None
        self._ready = False
        self.port = None

    async def restart(self) -> None:
        await self.stop()
        await self.start()


class VoilaManager:
    def __init__(self, repo_root: Path, notebook_dir: Path, base_url: str):
        self._process = VoilaProcess(
            repo_root=repo_root,
            notebook_dir=notebook_dir,
            base_url=base_url,
        )

    async def start_all(self) -> None:
        results = await asyncio.gather(self._process.start(), return_exceptions=True)
        for result in results:
            if isinstance(result, Exception):
                logger.error("[voila] Failed to start: %s", result)

    async def stop_all(self) -> None:
        await asyncio.gather(self._process.stop(), return_exceptions=True)

    def get_port(self) -> int | None:
        if not self._process.is_running:
            return None
        return self._process.port

    def is_ready(self) -> bool:
        return self._process.is_ready()

    def build_render_url(self, params: dict[str, str]) -> str:
        """Build the upstream render URL for a set of query params.

        Credentials are deliberately stripped from the query string here:
        AWS keys must not travel through the render URL (where they would surface
        in access logs, browser history, and proxy logs). QuiltKernelManager
        injects them into the per-session kernel ``env`` at render time instead
        (see translate_render_params / voila_kernel.QuiltKernelManager).

        NOTE: the live render URL is currently still assembled on the frontend
        (catalog/app/components/Preview/loaders/Voila.ts) and does include the
        credential params; moving that to a server-side token-keyed store is the
        intended follow-up. This server-side helper already models that end state.
        """
        from urllib.parse import urlencode

        port = self.get_port()
        base = f"http://127.0.0.1:{port}{self._process.base_url}voila/render/"
        safe_params = {k: v for k, v in params.items() if k not in _CREDENTIAL_PARAMS}
        query = urlencode(safe_params)
        return f"{base}?{query}" if query else base

    def inject_session_env(self, params: dict[str, str]) -> dict[str, str]:
        """Translate incoming render query params into per-session kernel env.

        Mirrors QuiltKernelManager so callers/tests can reason about the mapping.
        """
        return translate_render_params(params)


def translate_render_params(params: dict[str, str]) -> dict[str, str]:
    """Map render query params -> kernel env, layered on the inherited LOCAL backend env.

    pkg_bucket -> QUILT_PKG_BUCKET, pkg_name -> QUILT_PKG_NAME,
    pkg_top_hash -> QUILT_PKG_TOP_HASH; access_key -> AWS_ACCESS_KEY_ID,
    secret_key -> AWS_SECRET_ACCESS_KEY, session_token -> AWS_SESSION_TOKEN.
    """
    mapping = {
        "pkg_bucket": "QUILT_PKG_BUCKET",
        "pkg_name": "QUILT_PKG_NAME",
        "pkg_top_hash": "QUILT_PKG_TOP_HASH",
        "access_key": "AWS_ACCESS_KEY_ID",
        "secret_key": "AWS_SECRET_ACCESS_KEY",
        "session_token": "AWS_SESSION_TOKEN",
    }
    env = settings.local_backend_env()
    for src, dst in mapping.items():
        value = params.get(src)
        if value:
            env[dst] = value
    return env
