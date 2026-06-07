"""
Manages lambda subprocesses for the local catalog.

Each lambda runs in an isolated uv-managed environment as a subprocess,
communicating via HTTP on a dynamically-assigned port.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

STARTUP_TIMEOUT = 30.0
STOP_GRACE_PERIOD = 5.0


@dataclass
class LambdaConfig:
    name: str
    project_dir: str  # relative to repo root
    module: str  # e.g., "t4_lambda_preview"


@dataclass
class LambdaProcess:
    config: LambdaConfig
    repo_root: Path
    s3_proxy_origin: str
    port: int | None = field(default=None, init=False)
    _process: asyncio.subprocess.Process | None = field(default=None, init=False, repr=False)
    _stderr_task: asyncio.Task | None = field(default=None, init=False, repr=False)

    @property
    def is_running(self) -> bool:
        return self._process is not None and self._process.returncode is None

    async def start(self) -> None:
        if self.is_running:
            return

        runner_path = Path(__file__).parent / "lambda_runner.py"
        project_dir = self.repo_root / self.config.project_dir

        if not project_dir.exists():
            logger.error(f"[lambda:{self.config.name}] Project dir not found: {project_dir}")
            return

        cmd = [
            "uv",
            "run",
            "--project",
            str(project_dir),
            sys.executable if _same_python(project_dir) else "python",
            str(runner_path),
            "--module",
            self.config.module,
            "--port",
            "0",
            "--s3-proxy-origin",
            self.s3_proxy_origin,
        ]

        logger.info(f"[lambda:{self.config.name}] Starting: {' '.join(cmd)}")

        self._process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Read the ready signal from stdout
        try:
            port = await asyncio.wait_for(self._read_ready_signal(), STARTUP_TIMEOUT)
            self.port = port
            logger.info(f"[lambda:{self.config.name}] Ready on port {self.port}")
        except asyncio.TimeoutError:
            logger.error(f"[lambda:{self.config.name}] Startup timed out after {STARTUP_TIMEOUT}s")
            await self.stop()
            return
        except RuntimeError as e:
            logger.error(f"[lambda:{self.config.name}] Startup failed: {e}")
            await self.stop()
            return

        # Forward stderr in background
        self._stderr_task = asyncio.create_task(self._forward_stderr())

    async def _read_ready_signal(self) -> int:
        assert self._process and self._process.stdout
        while True:
            line = await self._process.stdout.readline()
            if not line:
                raise RuntimeError("Process exited before signaling readiness")
            decoded = line.decode().strip()
            if decoded.startswith("LAMBDA_READY port="):
                return int(decoded.split("=", 1)[1])

    async def _forward_stderr(self) -> None:
        assert self._process and self._process.stderr
        prefix = f"[lambda:{self.config.name}]"
        while True:
            line = await self._process.stderr.readline()
            if not line:
                break
            sys.stderr.write(f"{prefix} {line.decode()}")
            sys.stderr.flush()

    async def stop(self) -> None:
        if self._stderr_task and not self._stderr_task.done():
            self._stderr_task.cancel()
            self._stderr_task = None

        if self._process is None:
            return

        if self._process.returncode is None:
            self._process.send_signal(signal.SIGTERM)
            try:
                await asyncio.wait_for(self._process.wait(), STOP_GRACE_PERIOD)
            except asyncio.TimeoutError:
                self._process.kill()
                await self._process.wait()

        self._process = None
        self.port = None

    async def restart(self) -> None:
        await self.stop()
        await self.start()


class LambdaManager:
    def __init__(self, configs: list[LambdaConfig], repo_root: Path, s3_proxy_origin: str):
        self._processes: dict[str, LambdaProcess] = {
            cfg.name: LambdaProcess(config=cfg, repo_root=repo_root, s3_proxy_origin=s3_proxy_origin)
            for cfg in configs
        }

    async def start_all(self) -> None:
        results = await asyncio.gather(
            *(proc.start() for proc in self._processes.values()),
            return_exceptions=True,
        )
        for proc, result in zip(self._processes.values(), results):
            if isinstance(result, Exception):
                logger.error(f"[lambda:{proc.config.name}] Failed to start: {result}")

    async def stop_all(self) -> None:
        await asyncio.gather(
            *(proc.stop() for proc in self._processes.values()),
            return_exceptions=True,
        )

    def get_port(self, name: str) -> int | None:
        proc = self._processes.get(name)
        if proc is None or not proc.is_running:
            return None
        return proc.port

    def get_process(self, name: str) -> LambdaProcess | None:
        return self._processes.get(name)


def _same_python(project_dir: Path) -> bool:
    """Check if the lambda's requires-python is compatible with the current interpreter."""
    # Always False: let uv resolve the right Python via "python".
    return False


def detect_repo_root() -> Path:
    env_root = os.environ.get("QUILT_REPO_ROOT")
    if env_root:
        return Path(env_root).resolve()

    # Walk up from this file to find the repo root (contains lambdas/ dir)
    current = Path(__file__).resolve().parent
    for _ in range(10):
        if (current / "lambdas").is_dir() and (current / "api" / "python").is_dir():
            return current
        current = current.parent

    raise RuntimeError("Cannot detect repository root. Set QUILT_REPO_ROOT environment variable.")


LAMBDA_CONFIGS = [
    LambdaConfig(name="preview", project_dir="lambdas/preview", module="t4_lambda_preview"),
    LambdaConfig(name="thumbnail", project_dir="lambdas/thumbnail", module="t4_lambda_thumbnail"),
    LambdaConfig(name="tabular-preview", project_dir="lambdas/tabular_preview", module="t4_lambda_tabular_preview"),
    LambdaConfig(name="transcode", project_dir="lambdas/transcode", module="t4_lambda_transcode"),
]
