"""Local session tools and the official MCP Streamable HTTP client."""

import base64
import hashlib
import re
from contextlib import asynccontextmanager
from datetime import timedelta

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from .session import logical_path


def specification(name, description, properties, required):
    return {
        "toolSpec": {
            "name": name,
            "description": description,
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                    "additionalProperties": False,
                }
            },
        }
    }


class Tools:
    def __init__(self, session, mcp=None):
        self.session = session
        self.mcp = mcp
        self.remote_names = {}
        self.specs = [
            specification(
                "session_read",
                "Read a UTF-8 file from this session package (up to 512 KiB).",
                {"path": {"type": "string"}},
                ["path"],
            ),
            specification(
                "session_write",
                "Save a UTF-8 artifact under outputs/ in this session package.",
                {"path": {"type": "string"}, "text": {"type": "string"}},
                ["path", "text"],
            ),
        ]

    async def discover(self):
        if self.mcp is None:
            return
        cursor = None
        seen = set()
        while True:
            page = await self.mcp.list_tools(cursor=cursor)
            for tool in page.tools:
                digest = hashlib.sha256(tool.name.encode()).hexdigest()[:12]
                name = "platform__" + re.sub(r"[^a-zA-Z0-9_-]", "_", tool.name)[:40] + "_" + digest
                if name in self.remote_names:
                    raise ValueError("Duplicate MCP tool name")
                self.remote_names[name] = tool.name
                self.specs.append(
                    {
                        "toolSpec": {
                            "name": name,
                            "description": tool.description or tool.name,
                            "inputSchema": {"json": tool.inputSchema},
                        }
                    }
                )
            cursor = page.nextCursor
            if not cursor:
                break
            if cursor in seen:
                raise ValueError("MCP returned a repeated tools cursor")
            seen.add(cursor)

    async def execute(self, name, arguments):
        if name == "session_read":
            return {"status": "success", "content": [{"text": self.session.read(arguments["path"])}]}
        if name == "session_write":
            path = logical_path(arguments["path"])
            if not path.startswith("outputs/"):
                raise ValueError("Session writes must be under outputs/")
            self.session.write(path, arguments["text"])
            return {"status": "success", "content": [{"text": f"Saved {path}"}]}
        result = await self.mcp.call_tool(self.remote_names[name], arguments)
        content = []
        for block in result.content:
            value = block.model_dump(mode="json", by_alias=True, exclude_none=True)
            if value["type"] == "text":
                content.append({"text": value["text"]})
            elif value["type"] == "image" and value["mimeType"] in (
                "image/png",
                "image/jpeg",
                "image/gif",
                "image/webp",
            ):
                content.append(
                    {
                        "image": {
                            "format": value["mimeType"].split("/")[1],
                            "source": {"bytes": base64.b64decode(value["data"], validate=True)},
                        }
                    }
                )
            else:
                content.append({"json": value})
        if result.structuredContent is not None:
            content.append({"json": result.structuredContent})
        return {
            "status": "error" if result.isError else "success",
            "content": content or [{"text": "Tool returned no content."}],
        }


@asynccontextmanager
async def connect(session, url, token, timeout):
    if not url:
        yield Tools(session)
        return
    if not token:
        raise ValueError("QUILT_API_KEY is required when FARADAY_MCP_URL is configured")
    async with httpx.AsyncClient(
        headers={"Authorization": f"Bearer {token}"},
        timeout=httpx.Timeout(timeout, connect=min(timeout, 10)),
        follow_redirects=False,
    ) as http_client:
        async with streamable_http_client(url, http_client=http_client) as (read, write, _):
            async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=timeout)) as client:
                await client.initialize()
                tools = Tools(session, client)
                await tools.discover()
                yield tools
