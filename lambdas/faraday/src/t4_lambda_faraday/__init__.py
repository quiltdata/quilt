"""Faraday Lambda entry point. Configure credentials in the environment, never in session packages."""

import asyncio
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from pydantic import BaseModel, ConfigDict, Field

# Package reads do not need a persistent local cache, including on Lambda's read-only filesystem.
os.environ.setdefault("QUILT_DISABLE_CACHE", "true")

from .runner import Limits, run
from .session import Session
from .tools import connect

DEFAULT_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"


class SessionRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    registry: str = Field(pattern=r"^s3://[a-z0-9][a-z0-9.-]+[a-z0-9]/?$")
    package: str = Field(pattern=r"^[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$")


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session: SessionRef
    action: str = Field(default="run", pattern=r"^(init|run)$")
    task: str | None = Field(default=None, min_length=1, max_length=32000)
    agents: str | None = Field(default=None, min_length=1, max_length=128000)


async def invoke(event, context=None):
    request = Request.model_validate(event)
    if request.action == "init":
        if request.agents is None or request.task is not None:
            raise ValueError("init requires agents and does not accept task")
    elif request.task is None or not request.task.strip() or request.agents is not None:
        raise ValueError("run requires task and reads AGENTS.md from the package")

    with TemporaryDirectory(prefix="faraday-") as directory:
        args = (request.session.registry.rstrip("/"), request.session.package, Path(directory))
        if request.action == "init":
            session = Session.create(*args, request.agents)
            top_hash = session.save()
            return {"session": {**request.session.model_dump(), "top_hash": top_hash}, "status": "ready"}

        seconds = float(os.environ.get("FARADAY_MAX_SECONDS", "240"))
        if context is not None:
            seconds = min(seconds, context.get_remaining_time_in_millis() / 1000 - 30)
        limits = Limits(
            turns=int(os.environ.get("FARADAY_MAX_TURNS", "12")),
            seconds=seconds,
            output_tokens=int(os.environ.get("FARADAY_MAX_TOKENS", "4096")),
        )
        if limits.turns < 1 or limits.seconds < 1 or limits.output_tokens < 1:
            raise ValueError("Execution limits must be positive; Lambda needs at least 31 seconds remaining")
        url = os.environ.get("FARADAY_MCP_URL")
        if url:
            parsed = urlparse(url)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError("FARADAY_MCP_URL must be an HTTPS endpoint without embedded credentials")
        session = Session.load(*args)
        client = boto3.client(
            "bedrock-runtime",
            config=Config(
                connect_timeout=min(10, seconds),
                read_timeout=min(60, seconds),
                retries={"total_max_attempts": 1},
            ),
        )
        try:
            async with connect(session, url, os.environ.get("QUILT_API_KEY"), seconds) as tools:
                return await run(
                    session, request.task, os.environ.get("FARADAY_MODEL_ID", DEFAULT_MODEL), client, tools, limits
                )
        finally:
            client.close()


def lambda_handler(event, context):
    return asyncio.run(invoke(event, context))
