import inspect
import re

import pytest

from quilt_shared import iceberg_queries


@pytest.fixture
def qm():
    return iceberg_queries.QueryMaker(user_athena_db="testdb")


def test_package_revision_add_bucket_smoke(qm):
    sql = qm.package_revision_add_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert 'MERGE INTO "bucket1_package_revision"' in sql


def test_package_revision_add_single_smoke(qm):
    sql = qm.package_revision_add_single(bucket="bucket1", pkg_name="pkg", pointer="123", top_hash="abc")
    assert isinstance(sql, str)
    assert 'MERGE INTO "bucket1_package_revision"' in sql
    assert "pkg" in sql
    assert "123" in sql
    assert "abc" in sql


def test_package_revision_delete_single_smoke(qm):
    sql = qm.package_revision_delete_single(bucket="bucket1", pkg_name="pkg", pointer="123")
    assert isinstance(sql, str)
    assert 'DELETE FROM "bucket1_package_revision"' in sql
    assert "pkg" in sql
    assert "123" in sql


def test_package_tag_add_bucket_smoke(qm):
    sql = qm.package_tag_add_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert 'MERGE INTO "bucket1_package_tag"' in sql


def test_package_tag_add_single_smoke(qm):
    sql = qm.package_tag_add_single(bucket="bucket1", pkg_name="pkg", pointer="tag", top_hash="abc")
    assert isinstance(sql, str)
    assert 'MERGE INTO "bucket1_package_tag"' in sql
    assert "pkg" in sql
    assert "tag" in sql
    assert "abc" in sql


def test_package_tag_delete_single_smoke(qm):
    sql = qm.package_tag_delete_single(bucket="bucket1", pkg_name="pkg", pointer="tag")
    assert isinstance(sql, str)
    assert 'DELETE FROM "bucket1_package_tag"' in sql
    assert "pkg" in sql
    assert "tag" in sql


def test_package_manifest_add_bucket_smoke(qm):
    sql = qm.package_manifest_add_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert 'MERGE INTO "bucket1_package_manifest"' in sql


def test_package_manifest_add_single_smoke(qm):
    sql = qm.package_manifest_add_single(bucket="bucket1", top_hash="abc")
    assert isinstance(sql, str)
    assert 'MERGE INTO "bucket1_package_manifest"' in sql
    assert "abc" in sql


def test_package_manifest_delete_single_smoke(qm):
    sql = qm.package_manifest_delete_single(bucket="bucket1", top_hash="abc")
    assert isinstance(sql, str)
    assert 'DELETE FROM "bucket1_package_manifest"' in sql
    assert "abc" in sql


def test_package_entry_add_bucket_smoke(qm):
    sql = qm.package_entry_add_bucket(bucket="bucket1")
    assert isinstance(sql, str)
    assert 'MERGE INTO "bucket1_package_entry"' in sql


def test_package_entry_add_single_smoke(qm):
    sql = qm.package_entry_add_single(bucket="bucket1", top_hash="abc")
    assert isinstance(sql, str)
    assert 'MERGE INTO "bucket1_package_entry"' in sql
    assert "abc" in sql


def test_package_entry_delete_single_smoke(qm):
    sql = qm.package_entry_delete_single(bucket="bucket1", top_hash="abc")
    assert isinstance(sql, str)
    assert 'DELETE FROM "bucket1_package_entry"' in sql
    assert "abc" in sql


# Unescaped, either quote character ends the literal or identifier it lands in.
QUOTED = "x'y\"z"

BENIGN = {
    "user_athena_db": "testdb",
    "bucket": "bucket1",
    "pkg_name": "ns/pkg",
    "pointer": "1234567890",
    "top_hash": "0" * 64,
}

NUMERIC_SLOTS = [
    ("package_revision_add_single", "pointer"),
    ("package_revision_delete_single", "pointer"),
]

_TOKEN = re.compile(r"""'(?P<lit>(?:[^']|'')*)'|"(?P<ident>(?:[^"]|"")*)"|(?P<code>[^'"]+)""")


def _tokens(sql: str) -> list[tuple[str, str]]:
    matches = list(_TOKEN.finditer(sql))
    assert "".join(m[0] for m in matches) == sql, f"unterminated quote in: {sql}"
    tokens = []
    for m in matches:
        kind, text = m.lastgroup, m[m.lastgroup]
        if kind == "lit":
            text = text.replace("''", "'")
        elif kind == "ident":
            text = text.replace('""', '"')
        tokens.append((kind, text))
    return tokens


def _render(method: str, **values: str) -> str:
    values = {**BENIGN, **values}
    func = getattr(iceberg_queries.QueryMaker(user_athena_db=values["user_athena_db"]), method)
    return func(**{param: values[param] for param in inspect.signature(func).parameters})


METHODS = [
    name for name, _ in inspect.getmembers(iceberg_queries.QueryMaker, inspect.isfunction) if not name.startswith("_")
]
# A method's own parameter is always a case, so a value the SQL transforms fails rather than drops out.
ESCAPED_SLOTS = [
    (method, slot)
    for method in METHODS
    for slot in BENIGN
    if (method, slot) not in NUMERIC_SLOTS
    and (
        slot in inspect.signature(getattr(iceberg_queries.QueryMaker, method)).parameters
        or BENIGN[slot] in _render(method)
    )
]


@pytest.mark.parametrize(("method", "slot"), ESCAPED_SLOTS)
def test_value_with_quotes_stays_inside_its_literal_or_identifier(method, slot):
    benign = _tokens(_render(method))
    quoted = _tokens(_render(method, **{slot: QUOTED}))
    assert quoted == [(kind, text if kind == "code" else text.replace(BENIGN[slot], QUOTED)) for kind, text in benign]


@pytest.mark.parametrize(("method", "slot"), NUMERIC_SLOTS)
def test_revision_pointer_must_be_an_integer(method, slot):
    with pytest.raises(ValueError):
        _render(method, **{slot: QUOTED})
