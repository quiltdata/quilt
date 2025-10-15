import pytest

from quilt_shared import iceberg_queries


@pytest.fixture
def qm():
    return iceberg_queries.QueryMaker(user_athena_db="testdb")


def test_package_revision_add_bucket_smoke(qm):
    sql = qm.package_revision_add_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert "MERGE INTO package_revision" in sql
    assert "bucket1" in sql


def test_package_revision_add_single_smoke(qm):
    sql = qm.package_revision_add_single(bucket="bucket1", pkg_name="pkg", pointer="123", top_hash="abc")
    assert isinstance(sql, str)
    assert "MERGE INTO package_revision" in sql
    assert "pkg" in sql
    assert "123" in sql
    assert "abc" in sql


def test_package_revision_delete_bucket_smoke(qm):
    sql = qm.package_revision_delete_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert "DELETE FROM package_revision" in sql
    assert "bucket1" in sql


def test_package_revision_delete_single_smoke(qm):
    sql = qm.package_revision_delete_single(bucket="bucket1", pkg_name="pkg", pointer="123")
    assert isinstance(sql, str)
    assert "DELETE FROM package_revision" in sql
    assert "pkg" in sql
    assert "123" in sql


def test_package_tag_add_bucket_smoke(qm):
    sql = qm.package_tag_add_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert "MERGE INTO package_tag" in sql
    assert "bucket1" in sql


def test_package_tag_add_single_smoke(qm):
    sql = qm.package_tag_add_single(bucket="bucket1", pkg_name="pkg", pointer="tag", top_hash="abc")
    assert isinstance(sql, str)
    assert "MERGE INTO package_tag" in sql
    assert "pkg" in sql
    assert "tag" in sql
    assert "abc" in sql


def test_package_tag_delete_bucket_smoke(qm):
    sql = qm.package_tag_delete_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert "DELETE FROM package_tag" in sql
    assert "bucket1" in sql


def test_package_tag_delete_single_smoke(qm):
    sql = qm.package_tag_delete_single(bucket="bucket1", pkg_name="pkg", pointer="tag")
    assert isinstance(sql, str)
    assert "DELETE FROM package_tag" in sql
    assert "pkg" in sql
    assert "tag" in sql


def test_package_manifest_add_bucket_smoke(qm):
    sql = qm.package_manifest_add_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert "MERGE INTO package_manifest" in sql
    assert "bucket1" in sql


def test_package_manifest_add_single_smoke(qm):
    sql = qm.package_manifest_add_single(bucket="bucket1", top_hash="abc")
    assert isinstance(sql, str)
    assert "MERGE INTO package_manifest" in sql
    assert "bucket1" in sql
    assert "abc" in sql


def test_package_manifest_delete_bucket_smoke(qm):
    sql = qm.package_manifest_delete_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert "DELETE FROM package_manifest" in sql
    assert "bucket1" in sql


def test_package_manifest_delete_single_smoke(qm):
    sql = qm.package_manifest_delete_single(bucket="bucket1", top_hash="abc")
    assert isinstance(sql, str)
    assert "DELETE FROM package_manifest" in sql
    assert "abc" in sql


def test_package_entry_add_bucket_smoke(qm):
    sql = qm.package_entry_add_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert "MERGE INTO package_entry" in sql
    assert "bucket1" in sql


def test_package_entry_add_single_smoke(qm):
    sql = qm.package_entry_add_single(bucket="bucket1", top_hash="abc")
    assert isinstance(sql, str)
    assert "MERGE INTO package_entry" in sql
    assert "bucket1" in sql
    assert "abc" in sql


def test_package_entry_delete_bucket_smoke(qm):
    sql = qm.package_entry_delete_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert "DELETE FROM package_entry" in sql
    assert "bucket1" in sql


def test_package_entry_delete_single_smoke(qm):
    sql = qm.package_entry_delete_single(bucket="bucket1", top_hash="abc")
    assert isinstance(sql, str)
    assert "DELETE FROM package_entry" in sql
    assert "abc" in sql
