"""Durable sessions, using Quilt's normal manifests, versions, and push semantics."""

import base64
import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

import quilt3
from quilt3.packages import PackageEntry

MAX_TEXT_BYTES = 512 * 1024
MAX_HISTORY_BYTES = 8 * 1024 * 1024


def encode(value):
    if isinstance(value, bytes):
        return {"__faraday_bytes__": base64.b64encode(value).decode("ascii")}
    raise TypeError(f"Cannot serialize {type(value).__name__}")


def decode(value):
    if set(value) == {"__faraday_bytes__"}:
        return base64.b64decode(value["__faraday_bytes__"], validate=True)
    return value


def logical_path(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or any(p in ("", ".", "..") for p in value.split("/")):
        raise ValueError("Expected a relative package file path without dot segments")
    return str(path)


@dataclass
class Session:
    registry: str
    name: str
    workspace: Path
    package: quilt3.Package
    state: dict = field(default_factory=dict)
    messages: list = field(default_factory=list)
    pending: dict = field(default_factory=dict)

    @classmethod
    def load(cls, registry, name, workspace):
        # A failed browse (including access denied) must never create a new session.
        package = quilt3.Package.browse(name, registry=registry)
        session = cls(registry, name, workspace, package)
        session.state = json.loads(session.read("session.json"))
        if session.state.get("format_version") != 1:
            raise ValueError("Unsupported Faraday session format")
        session.messages = [
            json.loads(line, object_hook=decode)
            for line in session.read("conversation.jsonl", limit=MAX_HISTORY_BYTES).splitlines()
            if line.strip()
        ]
        if not session.read("AGENTS.md").strip():
            raise ValueError("Session AGENTS.md must not be empty")
        return session

    @classmethod
    def create(cls, registry, name, workspace, agents):
        if not agents.strip():
            raise ValueError("AGENTS.md must not be empty")
        session = cls(registry, name, workspace, quilt3.Package())
        session.state = {"format_version": 1, "status": "ready", "runs": []}
        session.write("AGENTS.md", agents)
        session.write("README.md", f"# Faraday session: {name}\n\nInstructions: AGENTS.md. Results: outputs/.\n")
        return session

    def keys(self):
        return sorted({key for key, _ in self.package.walk()} | self.pending.keys())

    def read(self, key, *, limit=MAX_TEXT_BYTES):
        key = logical_path(key)
        if key in self.pending:
            data = self.pending[key].read_bytes()
        else:
            entry = self.package[key]
            if not isinstance(entry, PackageEntry):
                raise ValueError("Expected a file, not a package directory")
            if entry.size is None or entry.size > limit:
                raise ValueError("Session file exceeds the read limit or has unknown size")
            dest = self.workspace / f"read-{uuid.uuid4().hex}"
            entry.fetch(str(dest))
            data = dest.read_bytes()
            dest.unlink()
        if len(data) > limit:
            raise ValueError("Session file exceeds the read limit")
        return data.decode("utf-8")

    def write(self, key, text, *, limit=MAX_TEXT_BYTES):
        key = logical_path(key)
        if len(text.encode("utf-8")) > limit:
            raise ValueError("Session file exceeds the write limit")
        dest = self.workspace / f"write-{uuid.uuid4().hex}"
        dest.write_text(text, encoding="utf-8")
        self.pending[key] = dest

    def save(self):
        self.write("session.json", json.dumps(self.state, indent=2))
        history = "".join(json.dumps(m, default=encode) + "\n" for m in self.messages)
        self.write("conversation.jsonl", history, limit=MAX_HISTORY_BYTES)
        for key, path in self.pending.items():
            self.package.set(key, str(path))
        # Unique immutable object destinations keep earlier package versions readable
        # even in an S3 bucket without object versioning. Quilt handles manifests and conflicts.
        dest = f"{self.registry.rstrip('/')}/faraday-sessions/{self.name}/{uuid.uuid4().hex}/"
        self.package = self.package.push(
            self.name,
            registry=self.registry,
            dest=dest,
            selector_fn=quilt3.Package.selector_fn_copy_local,
            message=f"Faraday: {self.state['status']}",
        )
        self.pending.clear()
        return self.package.top_hash
