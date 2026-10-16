import io
import json
import types

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


LATEST_KEY = f".quilt/named_packages/{NAME}/latest"


def copy_package(pkg):
    buf = io.StringIO()
    pkg.dump(buf)
    buf.seek(0)
    return quilt3.Package.load(buf)


def client_error(code, op):
    return botocore.exceptions.ClientError({"Error": {"Code": code, "Message": code}}, op)


@pytest.fixture
def env(mocker):
    """Stub S3 at quilt3's and the user client's boundary; record what gets hashed and written."""
    # The `latest` pointer, with an ETag that changes whenever it is written, as S3's does.
    latest = {"value": PARENT_HASH}

    def etag():
        return f'"{latest["value"]}"'

    def get_object(Bucket, Key):
        assert (Bucket, Key) == (BUCKET, LATEST_KEY)
        if latest["value"] is None:
            raise client_error("NoSuchKey", "GetObject")
        return {"Body": io.BytesIO(latest["value"].encode()), "ETag": etag()}

    # Every object write, in order: (key, body, precondition).
    writes = []
    # Manifests in the registry, by key.
    manifests = {}

    def put_object(Bucket, Key, Body, **precondition):
        assert Bucket == BUCKET
        exists = latest["value"] is not None if Key == LATEST_KEY else Key in manifests
        if precondition.get("IfNoneMatch") == "*" and exists:
            raise client_error("PreconditionFailed", "PutObject")
        if "IfMatch" in precondition and (Key != LATEST_KEY or not exists or precondition["IfMatch"] != etag()):
            raise client_error("PreconditionFailed", "PutObject")
        writes.append((Key, Body, precondition))
        if Key == LATEST_KEY:
            latest["value"] = Body.decode()
        else:
            manifests[Key] = Body

    def put_bytes(data, pk):
        assert pk.bucket == BUCKET
        writes.append((pk.path, data, None))

    # Revisions that can be browsed, by top hash.
    revisions = {PARENT_HASH: PARENT}

    def browse(name, registry, top_hash):
        assert name == NAME
        return copy_package(revisions[top_hash])

    hashed = []

    def calculate_pkg_hashes(pkg, scratch_buckets, checksum_algorithms):
        for lk, entry in pkg.walk():
            if entry.hash is None:
                hashed.append(lk)
                entry.hash = {"type": "SHA256", "value": "0" * 64}

    user_s3 = mocker.MagicMock()
    user_s3.head_object.side_effect = lambda **kw: {"ContentLength": 5, "VersionId": "v1"}
    user_s3.get_object.side_effect = get_object
    user_s3.put_object.side_effect = put_object
    # The package's pointers directory: no timestamped revisions unless a test adds one.
    user_s3.list_objects_v2.return_value = {"KeyCount": 0}
    session = mocker.MagicMock()
    session.client.return_value = user_s3

    mocker.patch("quilt3.data_transfer.put_bytes", side_effect=put_bytes)
    browse_mock = mocker.patch.object(quilt3.Package, "browse", side_effect=browse)
    mocker.patch.object(
        t4_lambda_pkgpush, "get_checksum_algorithms", return_value=[t4_lambda_pkgpush.ChecksumAlgorithm.SHA256_CHUNKED]
    )
    mocker.patch.object(t4_lambda_pkgpush, "calculate_pkg_hashes", side_effect=calculate_pkg_hashes)
    mocker.patch("quilt3.Package._validate_with_workflow")
    sleep = mocker.patch("time.sleep")

    def built():
        """The revision `latest` now names, loaded from its manifest."""
        key = f".quilt/packages/{latest['value']}"
        assert key in manifests, "`latest` names a revision with no manifest"
        return quilt3.Package.load(io.BytesIO(manifests[key]))

    def run(*lines, max_files_to_hash=10**9):
        with t4_lambda_pkgpush.setup_user_boto_session(session):
            t4_lambda_pkgpush.construct_package(
                request(*lines), patch=True, max_files_to_hash=max_files_to_hash, max_bytes_to_hash=10**9
            )
        return built()

    return types.SimpleNamespace(
        latest=latest,
        hashed=hashed,
        user_s3=user_s3,
        browse=browse_mock,
        writes=writes,
        manifests=manifests,
        revisions=revisions,
        session=session,
        sleep=sleep,
        built=built,
        run=run,
    )


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


def test_explicit_entry_wins_over_prefix(env):
    env.user_s3.get_paginator.return_value.paginate.return_value = [
        {"Versions": [{"Key": "pre/x", "VersionId": "vx", "IsLatest": True, "Size": 3}]}
    ]
    explicit = new_entry("data/x", size=1, hash={"type": "SHA256", "value": "1" * 64})
    pkg = env.run(header(), explicit, new_entry("data/", "s3://src/pre/"))
    assert pkg["data/x"].physical_key == PhysicalKey.from_url(explicit["physical_key"])


def test_prefix_rejects_version(env):
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        env.run(header(), new_entry("data/", "s3://src/pre/?versionId=v"))
    assert exc.value.name == "InvalidS3PhysicalKey"


def test_parent_not_latest_fails_before_hashing(env):
    env.latest["value"] = OTHER_HASH
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        env.run(header(parent=PARENT_HASH), new_entry("new.txt"))
    assert exc.value.name == "ParentNotLatest"
    assert exc.value.context == {"parent": PARENT_HASH, "latest": OTHER_HASH}
    env.browse.assert_not_called()
    assert env.hashed == []
    assert env.writes == []


def move_latest_while_hashing(env, mocker, times):
    """Another writer publishes a revision with `winner.txt` added while the patch hashes, `times` times."""
    hash_entries = t4_lambda_pkgpush.calculate_pkg_hashes
    remaining = times

    def hash_while_latest_moves(*args):
        nonlocal remaining
        hash_entries(*args)
        if remaining:
            remaining -= 1
            winner = copy_package(env.revisions[env.latest["value"]])
            entry_hash = {"type": "SHA256", "value": str(remaining) * 64}
            winner.set("winner.txt", quilt3.packages.PackageEntry(PhysicalKey(BUCKET, "w", "v0"), 1, entry_hash, None))
            env.revisions[winner.top_hash] = winner
            env.latest.update(value=winner.top_hash)

    mocker.patch.object(t4_lambda_pkgpush, "calculate_pkg_hashes", side_effect=hash_while_latest_moves)


def test_pinned_patch_fails_when_latest_moves(env, mocker):
    move_latest_while_hashing(env, mocker, 1)
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        env.run(header(parent=PARENT_HASH), new_entry("new.txt"))
    assert exc.value.name == "ParentNotLatest"
    assert exc.value.context == {"parent": PARENT_HASH, "latest": env.latest["value"]}
    # The other writer's pointer stands, and no revision pointer (no package-revision event) was written.
    assert env.latest["value"] != PARENT_HASH
    assert [key for key, _, _ in env.writes if key.startswith(".quilt/named_packages/")] == []


def test_unpinned_patch_reapplies_to_new_latest(env, mocker):
    paginator = env.user_s3.get_paginator.return_value
    paginator.paginate.return_value = [
        {"Versions": [{"Key": "pre/x", "VersionId": "vx", "IsLatest": True, "Size": 3}]}
    ]
    move_latest_while_hashing(env, mocker, 1)

    pkg = env.run(header(delete=["a.txt"]), new_entry("new.txt"), new_entry("data/", "s3://src/pre/"))

    # The winner's entry is kept, and the patch's delete and sets are applied on top of it.
    assert keys(pkg) == ["data/x", "dir/b.txt", "dir/c.txt", "new.txt", "winner.txt"]
    # The patch's own entries were listed and hashed once, on the first attempt.
    paginator.paginate.assert_called_once()
    assert sorted(env.hashed) == ["data/x", "new.txt"]
    assert env.browse.call_count == 2
    assert [key for key, _, _ in env.writes if key.startswith(f".quilt/named_packages/{NAME}/1")] != []


def test_unpinned_patch_gives_up_after_three_lost_races(env, mocker):
    move_latest_while_hashing(env, mocker, 3)
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        env.run(header(), new_entry("new.txt"))
    assert exc.value.name == "ParentNotLatest"
    assert env.browse.call_count == 3
    assert [key for key, _, _ in env.writes if key.startswith(".quilt/named_packages/")] == []


def test_latest_write_is_conditional_and_precedes_revision_pointer(env, mocker):
    mocker.patch("time.time", return_value=1_700_000_000)
    pkg = env.run(header(parent=PARENT_HASH), new_entry("new.txt"))

    top_hash = pkg.top_hash
    assert [(key, precondition) for key, _, precondition in env.writes] == [
        (f".quilt/packages/{top_hash}", {"IfNoneMatch": "*"}),
        (LATEST_KEY, {"IfMatch": f'"{PARENT_HASH}"'}),
        (f".quilt/named_packages/{NAME}/1700000000", None),
    ]
    assert env.writes[-1][1] == top_hash.encode()


def test_latest_moved_by_own_retried_write_completes_revision(env, mocker):
    # The PUT of `latest` commits, but its response is lost and the retry fails the precondition.
    put_object = env.user_s3.put_object.side_effect

    def commit_then_precondition_failed(**kwargs):
        put_object(**kwargs)
        if kwargs["Key"] == LATEST_KEY:
            raise client_error("PreconditionFailed", "PutObject")

    env.user_s3.put_object.side_effect = commit_then_precondition_failed
    mocker.patch("time.time", return_value=1_700_000_000)
    pkg = env.run(header(parent=PARENT_HASH), new_entry("new.txt"))

    assert env.latest["value"] == pkg.top_hash
    assert env.writes[-1] == (f".quilt/named_packages/{NAME}/1700000000", pkg.top_hash.encode(), None)


def test_existing_manifest_is_not_rewritten(env):
    # Physical keys are outside the top hash: the same revision can be rebuilt pointing elsewhere.
    entry = {"size": 1, "hash": {"type": "SHA256", "value": "1" * 64}}
    first = env.run(header(), new_entry("new.txt", f"s3://{BUCKET}/new.txt?versionId=v1", **entry))
    env.latest["value"] = PARENT_HASH

    again = env.run(header(), new_entry("new.txt", f"s3://{BUCKET}/new.txt?versionId=v2", **entry))

    assert again.top_hash == first.top_hash
    assert env.latest["value"] == first.top_hash
    assert again["new.txt"].physical_key == PhysicalKey(BUCKET, "new.txt", "v1")


def conflict_on_puts(env, conflicts, key_prefix, on_conflict=lambda key: None):
    """Fail the first `conflicts` PUTs under `key_prefix` with a 409, as while another writer's is in flight."""
    put_object = env.user_s3.put_object.side_effect
    remaining = conflicts

    def put(**kwargs):
        nonlocal remaining
        if kwargs["Key"].startswith(key_prefix) and remaining:
            remaining -= 1
            on_conflict(kwargs["Key"])
            raise client_error("ConditionalRequestConflict", "PutObject")
        put_object(**kwargs)

    env.user_s3.put_object.side_effect = put


@pytest.mark.parametrize("other_lands", [True, False])
def test_manifest_retried_after_concurrent_creation(env, other_lands):
    def other_writer(key):
        if other_lands:
            env.manifests[key] = b"the other writer's manifest"

    conflict_on_puts(env, 1, ".quilt/packages/", other_writer)
    with t4_lambda_pkgpush.setup_user_boto_session(env.session):
        top_hash = t4_lambda_pkgpush.construct_package(
            request(header(), new_entry("new.txt")), patch=True, max_files_to_hash=10, max_bytes_to_hash=10**9
        ).top_hash

    # The other writer's manifest stands; if it never landed, this patch's own does.
    assert env.latest["value"] == top_hash
    assert f".quilt/packages/{top_hash}" in env.manifests
    assert (env.manifests[f".quilt/packages/{top_hash}"] == b"the other writer's manifest") is other_lands


def test_persistent_manifest_conflict_leaves_latest(env):
    conflict_on_puts(env, 3, ".quilt/packages/")
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        env.run(header(), new_entry("new.txt"))
    assert exc.value.name == "ManifestWriteConflict"
    assert env.latest["value"] == PARENT_HASH
    assert env.writes == []


def test_latest_write_retried_while_another_is_in_flight(env):
    conflict_on_puts(env, 2, LATEST_KEY)
    pkg = env.run(header(parent=PARENT_HASH), new_entry("new.txt"))

    assert env.latest["value"] == pkg.top_hash
    assert [c.args for c in env.sleep.call_args_list] == [(0.2,), (0.5,)]


def test_unpinned_patch_refuses_revisions_without_latest(env):
    env.latest["value"] = None
    env.user_s3.list_objects_v2.return_value = {"KeyCount": 1}
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        env.run(header(), new_entry("new.txt"))
    assert exc.value.name == "LatestMissing"
    assert exc.value.context == {"package": NAME}
    env.user_s3.list_objects_v2.assert_called_once_with(
        Bucket=BUCKET, Prefix=f".quilt/named_packages/{NAME}/", MaxKeys=1
    )
    assert env.writes == []


def test_unlistable_revisions_are_forbidden(env):
    env.latest["value"] = None
    env.user_s3.list_objects_v2.side_effect = client_error("AccessDenied", "ListObjectsV2")
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        env.run(header(), new_entry("new.txt"))
    assert exc.value.name == "Forbidden"


def test_new_package_latest_write_requires_absence(env):
    env.latest["value"] = None
    env.run(header(), new_entry("new.txt"))
    assert [precondition for key, _, precondition in env.writes if key == LATEST_KEY] == [{"IfNoneMatch": "*"}]


def test_unreadable_latest_pointer_is_forbidden(env):
    env.user_s3.get_object.side_effect = client_error("AccessDenied", "GetObject")
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        env.run(header())
    assert exc.value.name == "Forbidden"


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


def request_file_key(request_type):
    return {"Bucket": "service-bucket", "Key": f"user-requests/{request_type}", "VersionId": "req-v1"}


@pytest.fixture
def request_file(env, mocker):
    """Serve a request file from the service bucket; return the mocks that read and remove it."""

    def serve(*lines):
        body = request(*lines).getvalue()
        # The request file is read and removed with the lambda's own client, not the user's.
        service_s3 = t4_lambda_pkgpush.s3
        head = mocker.patch.object(service_s3, "head_object", return_value={"ContentLength": len(body)})
        mocker.patch.object(
            service_s3, "download_fileobj", side_effect=lambda bucket, key, f, ExtraArgs: f.write(body)
        )
        delete = mocker.patch.object(service_s3, "delete_object")
        mocker.patch.object(t4_lambda_pkgpush, "get_user_boto_session", return_value=env.session)
        return head, delete

    return serve


def invoke_create_package(params):
    credentials = {"key": "key", "secret": "secret", "token": "token"}
    return t4_lambda_pkgpush.create_package({"credentials": credentials, "params": params}, None)


def error_name(result):
    return result.get("error", {}).get("name")


def invoke_packager(event):
    t4_lambda_pkgpush.package_prefix_sqs({"Records": [{"body": json.dumps(event)}]}, None)


def test_async_patch_request(env, request_file):
    head, delete = request_file(header(delete=["a.txt"]), new_entry("new.txt"))

    invoke_packager({"patch_request": "req-v1"})

    head.assert_called_once_with(**request_file_key("patch-package"))
    delete.assert_called_once_with(**request_file_key("patch-package"))
    assert keys(env.built()) == ["dir/b.txt", "dir/c.txt", "new.txt"]


def test_sync_patch_request(env, request_file):
    head, _ = request_file(header(delete=["a.txt"]), new_entry("new.txt"))

    result = invoke_create_package({"patch_request": "req-v1"})

    head.assert_called_once_with(**request_file_key("patch-package"))
    assert result == {"result": {"top_hash": env.latest["value"]}}
    assert keys(env.built()) == ["dir/b.txt", "dir/c.txt", "new.txt"]


def test_sync_patch_request_has_hashing_limits(env, request_file, mocker):
    mocker.patch.object(t4_lambda_pkgpush, "MAX_FILES_TO_HASH", 0)
    request_file(header(), new_entry("new.txt"))

    result = invoke_create_package({"patch_request": "req-v1"})

    assert error_name(result) == "TooManyFilesToHash"
    assert env.writes == []


def test_patch_request_without_patch_is_rejected(env, request_file):
    plain_header = {k: v for k, v in header().items() if k != "patch"}
    request_file(plain_header, new_entry("new.txt"))
    assert error_name(invoke_create_package({"patch_request": "req-v1"})) == "InvalidPatchRequest"
    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as exc:
        invoke_packager({"patch_request": "req-v1"})
    assert exc.value.name == "InvalidPatchRequest"
    assert env.writes == []


def test_create_package_request_with_patch_is_rejected(env, request_file):
    head, _ = request_file(header(), new_entry("new.txt"))

    result = invoke_create_package("req-v1")

    head.assert_called_once_with(**request_file_key("create-package"))
    assert error_name(result) == "InvalidPatchRequest"
    assert env.writes == []


@pytest.mark.parametrize(
    "fields, valid",
    [
        ({"source_prefix": "s3://bucket/prefix/"}, True),
        ({"patch_request": "req-v1"}, True),
        ({}, False),
        ({"source_prefix": "s3://bucket/prefix/", "patch_request": "req-v1"}, False),
        ({"patch_request": "req-v1", "package_name": "a/b"}, False),
    ],
)
def test_packager_event_needs_exactly_one_source(fields, valid):
    if valid:
        t4_lambda_pkgpush.PackagerEvent(**fields)
    else:
        with pytest.raises(pydantic.v1.ValidationError):
            t4_lambda_pkgpush.PackagerEvent(**fields)
