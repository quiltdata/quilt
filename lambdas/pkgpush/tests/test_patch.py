import contextlib
import io
import json

import botocore.exceptions
import pydantic.v1
import pytest

import quilt3
import t4_lambda_pkgpush
from quilt3.util import PhysicalKey

BUCKET = "registry-bucket"
NAME = "user/pkg"
OTHER_HASH = "f" * 64


def make_parent():
    pkg = quilt3.Package()
    pkg.set_meta({"parent": "meta"})
    for lk in ("a.txt", "dir/b.txt", "dir/c.txt"):
        pkg.set(
            lk,
            quilt3.packages.PackageEntry(
                PhysicalKey(BUCKET, f"src/{lk}", "v0"),
                1,
                {"type": "SHA256", "value": lk.encode().hex().ljust(64, "0")},
                None,
            ),
        )
    return pkg


PARENT = make_parent()
PARENT_HASH = PARENT.top_hash


def header(**patch):
    return {
        "bucket": BUCKET,
        "name": NAME,
        "message": "msg",
        "scratch_buckets": {},
        "patch": patch,
    }


def new_entry(lk, pk=None, **kwargs):
    return {"logical_key": lk, "physical_key": pk or f"s3://{BUCKET}/new/{lk}?versionId=v1", **kwargs}


def request(*lines):
    return io.BytesIO("\n".join(map(json.dumps, lines)).encode())


@pytest.fixture
def env(mocker):
    """Stub S3 at quilt3's and the user client's boundary; record what gets hashed and built."""
    latest = {"value": PARENT_HASH}

    def get_bytes(pk):
        assert pk == PhysicalKey(BUCKET, f".quilt/named_packages/{NAME}/latest", None)
        if latest["value"] is None:
            raise botocore.exceptions.ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
        return latest["value"].encode()

    def browse(name, registry, top_hash):
        assert (name, top_hash) == (NAME, PARENT_HASH)
        buf = io.StringIO()
        PARENT.dump(buf)
        buf.seek(0)
        return quilt3.Package.load(buf)

    hashed = []

    def calculate_pkg_hashes(pkg, scratch_buckets, checksum_algorithms):
        for lk, entry in pkg.walk():
            if entry.hash is None:
                hashed.append(lk)
                entry.hash = {"type": "SHA256", "value": "0" * 64}

    user_s3 = mocker.MagicMock()
    user_s3.head_object.side_effect = lambda **kw: {"ContentLength": 5, "VersionId": "v1"}
    session = mocker.MagicMock()
    session.client.return_value = user_s3

    mocker.patch("quilt3.data_transfer.get_bytes", side_effect=get_bytes)
    browse_mock = mocker.patch.object(quilt3.Package, "browse", side_effect=browse)
    mocker.patch.object(
        t4_lambda_pkgpush, "get_checksum_algorithms", return_value=[t4_lambda_pkgpush.ChecksumAlgorithm.SHA256_CHUNKED]
    )
    mocker.patch.object(t4_lambda_pkgpush, "calculate_pkg_hashes", side_effect=calculate_pkg_hashes)
    mocker.patch("quilt3.Package._validate_with_workflow")
    build = mocker.patch("quilt3.Package._build", autospec=True, return_value="0" * 64)

    class Env:
        pass

    e = Env()
    e.latest, e.hashed, e.user_s3, e.browse, e.build, e.session = latest, hashed, user_s3, browse_mock, build, session

    def run(*lines, max_files_to_hash=10**9):
        with t4_lambda_pkgpush.setup_user_boto_session(session):
            t4_lambda_pkgpush.construct_package(
                request(*lines), max_files_to_hash=max_files_to_hash, max_bytes_to_hash=10**9
            )
        (pkg,), _ = build.call_args
        return pkg

    e.run = run
    return e


def keys(pkg):
    return sorted(lk for lk, _ in pkg.walk())


def test_parent_entries_keep_hashes_and_skip_limits(env):
    pkg = env.run(header(parent=PARENT_HASH), new_entry("new.txt"), max_files_to_hash=1)

    assert env.hashed == ["new.txt"]
    assert keys(pkg) == ["a.txt", "dir/b.txt", "dir/c.txt", "new.txt"]
    for lk, entry in PARENT.walk():
        assert pkg[lk].hash == entry.hash
        assert pkg[lk].physical_key == entry.physical_key
    env.user_s3.head_object.assert_called_once()


def test_delete_runs_before_set(env):
    pkg = env.run(header(delete=["dir/"]), new_entry("dir/x"))
    assert keys(pkg) == ["a.txt", "dir/x"]


def test_delete_matches_kind(env):
    # "dir" names a directory without the trailing "/", so it stays; a missing key is a no-op.
    pkg = env.run(header(delete=["a.txt", "dir", "missing", "a.txt/x"]))
    assert keys(pkg) == ["dir/b.txt", "dir/c.txt"]


def test_prefix_expands_to_latest_versions(env):
    paginator = env.user_s3.get_paginator.return_value
    paginator.paginate.return_value = [
        {
            "Versions": [
                {"Key": "pre/x", "VersionId": "vx", "IsLatest": True, "Size": 3},
                {"Key": "pre/x", "VersionId": "old", "IsLatest": False, "Size": 2},
                {"Key": "pre/sub/y", "VersionId": "vy", "IsLatest": True, "Size": 4},
            ]
        }
    ]
    pkg = env.run(header(delete=["dir/"]), new_entry("data/", "s3://src/pre/", meta={"user_meta": {"k": 1}}))

    paginator.paginate.assert_called_once_with(Bucket="src", Prefix="pre/")
    assert keys(pkg) == ["a.txt", "data/sub/y", "data/x"]
    assert pkg["data/x"].physical_key == PhysicalKey("src", "pre/x", "vx")
    assert pkg["data/sub/y"].physical_key == PhysicalKey("src", "pre/sub/y", "vy")
    assert pkg["data/x"].meta == {"k": 1}


def test_prefix_needs_directory_logical_key(env):
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        env.run(header(), new_entry("data", "s3://src/pre/"))
    assert exc.value.name == "InvalidLogicalKey"


def test_parent_not_latest(env):
    env.latest["value"] = OTHER_HASH
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        env.run(header(parent=PARENT_HASH), new_entry("new.txt"))
    assert exc.value.name == "ParentNotLatest"
    assert exc.value.context == {"parent": PARENT_HASH, "latest": OTHER_HASH}
    env.build.assert_not_called()


@pytest.mark.parametrize(
    "user_meta, expected",
    [
        (..., {"parent": "meta"}),
        ({"new": "meta"}, {"new": "meta"}),
    ],
)
def test_user_meta_keep_or_replace(env, user_meta, expected):
    params = header()
    if user_meta is not ...:
        params["user_meta"] = user_meta
    assert env.run(params).meta == expected


def test_missing_package_without_parent_starts_empty(env):
    env.latest["value"] = None
    pkg = env.run(header(), new_entry("new.txt"))
    assert keys(pkg) == ["new.txt"]
    env.browse.assert_not_called()


def test_async_patch_request(env, mocker):
    request_file = mocker.patch.object(
        t4_lambda_pkgpush,
        "request_from_file",
        return_value=contextlib.nullcontext(request(header(delete=["a.txt"]), new_entry("new.txt"))),
    )
    mocker.patch.object(t4_lambda_pkgpush, "get_user_boto_session", return_value=env.session)

    t4_lambda_pkgpush.package_prefix_sqs({"Records": [{"body": json.dumps({"patch_request": "req-v1"})}]}, None)

    request_file.assert_called_once_with(
        bucket="service-bucket",
        request_type="patch-package",
        version_id="req-v1",
        s3=t4_lambda_pkgpush.s3,
        max_size=t4_lambda_pkgpush.LAMBDA_TMP_SPACE,
        logger=t4_lambda_pkgpush.logger,
    )
    (pkg,), _ = env.build.call_args
    assert keys(pkg) == ["dir/b.txt", "dir/c.txt", "new.txt"]


@pytest.mark.parametrize(
    "fields, valid",
    [
        ({"source_prefix": "s3://bucket/prefix/"}, True),
        ({"patch_request": "req-v1"}, True),
        ({}, False),
        ({"source_prefix": "s3://bucket/prefix/", "patch_request": "req-v1"}, False),
    ],
)
def test_packager_event_needs_exactly_one_source(fields, valid):
    if valid:
        t4_lambda_pkgpush.PackagerEvent(**fields)
    else:
        with pytest.raises(pydantic.v1.ValidationError):
            t4_lambda_pkgpush.PackagerEvent(**fields)
