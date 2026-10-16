"""Job record and a replaceable runner for the attempt's qualified -> running -> result_ready/run_failed edges.

Spec: quilt-specs changes/resume-state (state-names, ratified). Those three edges are
service edges — registry-internal, never a GraphQL slice mutation, driven by this job
record, never by a caller-supplied value. This module owns the job's own state machine
and submission; it does not call the registry. The registry attempt table does not
exist yet (quilt-specs#176 merged spec-only), so `AttemptSink` below is the seam: swap
the no-op default for a real registry call once that table lands. Everything else here
is already the real interface, not a demo stand-in.

Not a job runner for Nemotron or the packager queue (out of scope per the seat's own
note) — `JobRunner` is a protocol; plug in the real compute backend behind it.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol


class JobState(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass
class Job:
    job_id: str
    attempt_id: str
    state: JobState
    result_ref: str | None = None
    error: str | None = None
    attempts: int = 0
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


class JobRunner(Protocol):
    """The swappable compute backend. Raise to fail the job; return a result ref to succeed it."""

    def run(self, job: Job) -> str: ...


class AttemptSink(Protocol):
    """Drives the attempt's service edges. No-op until the registry attempt table exists."""

    def running(self, attempt_id: str) -> None: ...
    def result_ready(self, attempt_id: str, result_ref: str) -> None: ...
    def run_failed(self, attempt_id: str, error: str) -> None: ...


class NullAttemptSink:
    """Default sink: records nothing. Swap for a real registry call once the attempt table lands."""

    def running(self, attempt_id: str) -> None:
        pass

    def result_ready(self, attempt_id: str, result_ref: str) -> None:
        pass

    def run_failed(self, attempt_id: str, error: str) -> None:
        pass


class JobStore:
    """Durable job state, keyed by job_id. In-memory here; swap for a DynamoDB table (same
    get/put shape) without changing JobManager. One job_id maps to exactly one job, so a
    retried submission with the same job_id never creates a second job (idempotent submit).
    """

    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def put(self, job: Job) -> None:
        job.updated_at = time.time()
        self._jobs[job.job_id] = job


class JobManager:
    """Submits and advances jobs. Enforces the one real invariant the storyboard names:
    a failed run is never reported as succeeded, and vice versa — `run` catches the
    runner's own exception and routes to FAILED; nothing else can produce SUCCEEDED.
    """

    def __init__(self, store: JobStore | None = None, sink: AttemptSink | None = None) -> None:
        self.store = store or JobStore()
        self.sink = sink or NullAttemptSink()

    def submit(self, attempt_id: str, job_id: str | None = None) -> Job:
        """Idempotent: calling again with the same job_id returns the existing job unchanged."""
        job_id = job_id or str(uuid.uuid4())
        existing = self.store.get(job_id)
        if existing is not None:
            return existing
        job = Job(job_id=job_id, attempt_id=attempt_id, state=JobState.QUEUED)
        self.store.put(job)
        return job

    def run(self, job_id: str, runner: JobRunner) -> Job:
        """qualified -> running, then running -> result_ready or running -> run_failed."""
        job = self.store.get(job_id)
        if job is None:
            raise KeyError(f"no job {job_id}")
        job.state = JobState.RUNNING
        job.attempts += 1
        self.store.put(job)
        self.sink.running(job.attempt_id)
        try:
            result_ref = runner.run(job)
        except Exception as exc:  # noqa: BLE001 - any runner failure is a run_failed, by design
            job.state = JobState.FAILED
            job.error = str(exc)
            self.store.put(job)
            self.sink.run_failed(job.attempt_id, job.error)
            return job
        job.state = JobState.SUCCEEDED
        job.result_ref = result_ref
        self.store.put(job)
        self.sink.result_ready(job.attempt_id, result_ref)
        return job

    def retry(self, job_id: str, runner: JobRunner) -> Job:
        """run_failed -> qualified -> running (retry), per the spec's recoverable branch."""
        job = self.store.get(job_id)
        if job is None or job.state is not JobState.FAILED:
            raise ValueError(f"job {job_id} is not in a retriable state")
        job.state = JobState.QUEUED
        job.error = None
        self.store.put(job)
        return self.run(job_id, runner)


class FakeWorker:
    """Demo-only JobRunner: succeeds after a short delay, or raises if told to fail.
    Nemotron/BioNeMo/SageMaker integration is explicitly out of scope here.
    """

    def __init__(self, delay_seconds: float = 0.0, fail: bool = False) -> None:
        self.delay_seconds = delay_seconds
        self.fail = fail

    def run(self, job: Job) -> str:
        if self.delay_seconds:
            time.sleep(self.delay_seconds)
        if self.fail:
            raise RuntimeError("FakeWorker: injected failure")
        return f"fake-result://{job.job_id}"
