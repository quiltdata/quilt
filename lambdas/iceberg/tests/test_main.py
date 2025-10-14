import json

import pytest
import t4_lambda_iceberg

import quilt_shared.const
from botocore.stub import Stubber


@pytest.fixture
def s3_stub():
    stubber = Stubber(t4_lambda_iceberg.s3)
    stubber.activate()
    yield stubber
    stubber.deactivate()


def test_get_first_line_found(s3_stub, mocker):
    bucket = "bucket"
    key = "key"
    body_mock = mocker.Mock()
    body_mock.iter_lines.return_value = [b"firstline", b"secondline"]
    # Patch the response to use our mock body
    s3_stub.add_response(
        "get_object",
        {"Body": body_mock},
        {"Bucket": bucket, "Key": key},
    )
    assert t4_lambda_iceberg.get_first_line(bucket, key) == b"firstline"


def test_get_first_line_not_found(s3_stub):
    bucket = "bucket"
    key = "key"
    s3_stub.add_client_error(
        "get_object",
        service_error_code="NoSuchKey",
        service_message="Not found",
        http_status_code=404,
        expected_params={"Bucket": bucket, "Key": key},
    )
    assert t4_lambda_iceberg.get_first_line(bucket, key) is None


def test_process_s3_event():
    body = json.dumps({"detail": {"s3": {"bucket": {"name": "b"}, "object": {"key": "k"}}}})
    event = {"Records": [{"body": body}]}
    assert t4_lambda_iceberg.process_s3_event(event) == ("b", "k")


@pytest.mark.parametrize(
    "pointer, first_line, expected_func",
    [
        ("123", b"hash", "package_revision_add_single"),
        ("tag", b"hash", "package_tag_add_single"),
        ("123", None, "package_revision_delete_single"),
        ("tag", None, "package_tag_delete_single"),
    ],
)
def test_generate_queries_named_packages(mocker, pointer, first_line, expected_func):
    bucket = "b"
    pkg_name = "pkg"
    key = f"{quilt_shared.const.NAMED_PACKAGES_PREFIX}{pkg_name}/{pointer}"
    spy = mocker.spy(t4_lambda_iceberg.query_maker, expected_func)
    queries = t4_lambda_iceberg.generate_queries(bucket, key, first_line)
    assert len(queries) == 1
    assert spy.call_count == 1


@pytest.mark.parametrize(
    "first_line",
    [
        b"hash",
        None,
    ],
)
def test_generate_queries_manifests(mocker, first_line):
    bucket = "b"
    top_hash = "thash"
    key = f"{quilt_shared.const.MANIFESTS_PREFIX}{top_hash}"
    if first_line:
        spy1 = mocker.spy(t4_lambda_iceberg.query_maker, "package_manifest_add_single")
        spy2 = mocker.spy(t4_lambda_iceberg.query_maker, "package_entry_add_single")
    else:
        spy1 = mocker.spy(t4_lambda_iceberg.query_maker, "package_manifest_delete_single")
        spy2 = mocker.spy(t4_lambda_iceberg.query_maker, "package_entry_delete_single")

    queries = t4_lambda_iceberg.generate_queries(bucket, key, first_line)
    assert spy1.call_count == 1
    assert spy2.call_count == 1
    assert len(queries) == 2

def test_generate_queries_unexpected_key():
    with pytest.raises(ValueError):
        t4_lambda_iceberg.generate_queries("b", "unexpected/key", b"hash")
