from t4_lambda_async_jobs import FakeWorker, JobManager, JobState


def test_submit_is_idempotent():
    mgr = JobManager()
    a = mgr.submit("attempt-1", job_id="job-1")
    b = mgr.submit("attempt-1", job_id="job-1")
    assert a is b
    assert a.state == JobState.QUEUED


def test_run_succeeds():
    mgr = JobManager()
    job = mgr.submit("attempt-1")
    result = mgr.run(job.job_id, FakeWorker())
    assert result.state == JobState.SUCCEEDED
    assert result.result_ref == f"fake-result://{job.job_id}"
    assert result.error is None


def test_run_fails_and_never_reports_success():
    mgr = JobManager()
    job = mgr.submit("attempt-1")
    result = mgr.run(job.job_id, FakeWorker(fail=True))
    assert result.state == JobState.FAILED
    assert result.result_ref is None
    assert "injected failure" in result.error


def test_retry_after_failure_runs_again():
    mgr = JobManager()
    job = mgr.submit("attempt-1")
    mgr.run(job.job_id, FakeWorker(fail=True))
    result = mgr.retry(job.job_id, FakeWorker())
    assert result.state == JobState.SUCCEEDED
    assert result.attempts == 2


def test_sink_sees_the_right_edge_for_success_and_failure():
    calls = []

    class RecordingSink:
        def running(self, attempt_id):
            calls.append(("running", attempt_id))

        def result_ready(self, attempt_id, result_ref):
            calls.append(("result_ready", attempt_id, result_ref))

        def run_failed(self, attempt_id, error):
            calls.append(("run_failed", attempt_id, error))

    mgr = JobManager(sink=RecordingSink())
    job = mgr.submit("attempt-9")
    mgr.run(job.job_id, FakeWorker())
    assert calls[0] == ("running", "attempt-9")
    assert calls[1][0] == "result_ready"

    calls.clear()
    job2 = mgr.submit("attempt-10")
    mgr.run(job2.job_id, FakeWorker(fail=True))
    assert calls[0] == ("running", "attempt-10")
    assert calls[1][0] == "run_failed"
