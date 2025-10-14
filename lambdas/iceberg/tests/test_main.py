import json

import pytest
import t4_lambda_iceberg

import quilt_shared.const


@pytest.fixture
def s3_mock(mocker):
    return mocker.patch("t4_lambda_iceberg.s3")


def test_get_first_line_found(s3_mock, mocker):
    bucket = "bucket"
    key = "key"
    body_mock = mocker.Mock()
    body_mock.iter_lines.return_value = [b"firstline", b"secondline"]
    s3_mock.get_object.return_value = {"Body": body_mock}
    assert t4_lambda_iceberg.get_first_line(bucket, key) == b"firstline"
    s3_mock.get_object.assert_called_once_with(Bucket=bucket, Key=key)


def test_get_first_line_not_found(s3_mock):
    s3_mock.get_object.side_effect = s3_mock.exceptions.NoSuchKey
    assert t4_lambda_iceberg.get_first_line("bucket", "key") is None


def test_process_s3_event():
    body = json.dumps({"detail": {"s3": {"bucket": {"name": "b"}, "object": {"key": "k"}}}})
    event = {"Records": [{"body": body}]}
    assert t4_lambda_iceberg.process_s3_event(event) == ("b", "k")


@pytest.mark.parametrize(
    "prefix, pointer, first_line, expected_func",
    [
        (quilt_shared.const.NAMED_PACKAGES_PREFIX, "123", b"hash", "package_revision_add_single"),
        (quilt_shared.const.NAMED_PACKAGES_PREFIX, "tag", b"hash", "package_tag_add_single"),
        (quilt_shared.const.NAMED_PACKAGES_PREFIX, "123", None, "package_revision_delete_single"),
        (quilt_shared.const.NAMED_PACKAGES_PREFIX, "tag", None, "package_tag_delete_single"),
    ],
)
def test_generate_queries_named_packages(mocker, prefix, pointer, first_line, expected_func):
    bucket = "b"
    pkg_name = "pkg"
    key = f"{prefix}{pkg_name}/{pointer}"
    spy = mocker.spy(t4_lambda_iceberg.query_maker, expected_func)
    queries = t4_lambda_iceberg.generate_queries(bucket, key, first_line)
    assert len(queries) == 1
    assert spy.call_count == 1


@pytest.mark.parametrize(
    "first_line, add_func, del_func",
    [
        (b"hash", "package_manifest_add_single", "package_manifest_delete_single"),
        (None, "package_manifest_delete_single", "package_manifest_delete_single"),
    ],
)
def test_generate_queries_manifests(mocker, first_line, add_func, del_func):
    bucket = "b"
    top_hash = "thash"
    key = f"{quilt_shared.const.MANIFESTS_PREFIX}{top_hash}"
    if first_line:
        spy1 = mocker.spy(t4_lambda_iceberg.query_maker, "package_manifest_add_single")
        spy2 = mocker.spy(t4_lambda_iceberg.query_maker, "package_entry_add_single")
        queries = t4_lambda_iceberg.generate_queries(bucket, key, first_line)
        assert spy1.call_count == 1
        assert spy2.call_count == 1
        assert len(queries) == 2
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
