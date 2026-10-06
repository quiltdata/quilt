import quilt3.workflows

from t4_lambda_pkgpush import PkgpushException


def test_workflow_validation_error_carries_every_error():
    qe = quilt3.workflows.WorkflowValidationError("Package name doesn't match required pattern.")
    qe.errors = [{"path": "name", "message": "Package name doesn't match required pattern."}]

    exc = PkgpushException.from_quilt_exception(qe)

    assert exc.name == "WorkflowValidationError"
    assert exc.context == {"details": qe.message, "errors": qe.errors}


def test_other_quilt_exceptions_keep_details_only():
    exc = PkgpushException.from_quilt_exception(quilt3.util.QuiltException("Workflow required, but none specified."))

    assert exc.name == "QuiltException"
    assert exc.context == {"details": "Workflow required, but none specified."}
