import pytest
from botocore.exceptions import ClientError

import quilt3
from quilt3.util import QuiltConflictException
from t4_lambda_faraday.session import Session


def test_versions_preserve_prompt_history_outputs_and_inputs(registry, tmp_path):
    session = Session.create(registry, "faraday/demo", tmp_path, "Be precise.")
    session.write("inputs/source.txt", "Original evidence")
    first_hash = session.save()
    resumed = Session.load(registry, "faraday/demo", tmp_path)
    resumed.messages.append({"role": "assistant", "content": [{"image": {"source": {"bytes": b"abc"}}}]})
    resumed.write("outputs/report.md", "A report")
    second_hash = resumed.save()
    assert second_hash != first_hash
    latest = Session.load(registry, "faraday/demo", tmp_path)
    assert latest.messages[0]["content"][0]["image"]["source"]["bytes"] == b"abc"
    assert latest.read("AGENTS.md") == "Be precise."
    assert latest.read("inputs/source.txt") == "Original evidence"
    assert latest.read("outputs/report.md") == "A report"
    old = quilt3.Package.browse("faraday/demo", registry=registry, top_hash=first_hash)
    old["conversation.jsonl"].fetch(str(tmp_path / "old.jsonl"))
    assert (tmp_path / "old.jsonl").read_text() == ""
    assert "outputs/report.md" not in dict(old.walk())


def test_create_does_not_overwrite_existing_session(registry, tmp_path):
    original = Session.create(registry, "faraday/demo", tmp_path, "Original")
    expected = original.save()
    replacement = Session.create(registry, "faraday/demo", tmp_path, "Replacement")
    with pytest.raises(QuiltConflictException):
        replacement.save()
    assert quilt3.Package.browse("faraday/demo", registry=registry).top_hash == expected


def test_load_missing_session_does_not_create_it(registry, tmp_path):
    with pytest.raises(ClientError) as error:
        Session.load(registry, "faraday/missing", tmp_path)
    assert error.value.response["Error"]["Code"] == "NoSuchKey"


def test_invalid_session_and_oversize_files(registry, tmp_path):
    session = Session.create(registry, "faraday/demo", tmp_path, "Original")
    with pytest.raises(ValueError):
        session.write("../escape", "no")
    session.write("inputs/large.txt", "large")
    session.save()
    with pytest.raises(ValueError):
        session.read("inputs/large.txt", limit=2)
    session.state["format_version"] = 999
    session.save()
    with pytest.raises(ValueError, match="Unsupported"):
        Session.load(registry, "faraday/demo", tmp_path)


def test_empty_prompt_rejected(registry, tmp_path):
    with pytest.raises(ValueError, match="empty"):
        Session.create(registry, "faraday/demo", tmp_path, " \n")
