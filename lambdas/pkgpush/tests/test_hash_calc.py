import base64
import io
import json

import boto3
import pytest
from botocore.stub import Stubber
from pytest_mock import MockerFixture

import t4_lambda_pkgpush
from quilt3.packages import Package, PackageEntry
from quilt3.util import PhysicalKey
from quilt_shared.aws import AWSCredentials
from quilt_shared.pkgpush import Checksum, ChecksumType
from quilt_shared.types import NonEmptyStr

CREDENTIALS = AWSCredentials(
    key=NonEmptyStr("test_aws_access_key_id"),
    secret=NonEmptyStr("test_aws_secret_access_key"),
    token=NonEmptyStr("test_aws_session_token"),
)

SCRATCH_REGION = "us-east-1"
SCRATCH_BUCKET = "test-scratch-bucket"
SCRATCH_BUCKETS = {SCRATCH_REGION: SCRATCH_BUCKET}
SCRATCH_KEY = "test-scratch-key"


@pytest.fixture
def entry_with_hash() -> PackageEntry:
    return PackageEntry(
        PhysicalKey("test-bucket", "with-hash", "with-hash"),
        42,
        {"type": "SHA256", "value": "0" * 64},
        {},
    )


@pytest.fixture
def entry_without_hash() -> PackageEntry:
    return PackageEntry(
        PhysicalKey("test-bucket", "without-hash", "without-hash"),
        42,
        None,
        {},
    )


@pytest.fixture
def entry_without_hash_large() -> PackageEntry:
    return PackageEntry(
        PhysicalKey("test-bucket", "without-hash", "without-hash"),
        8 * 2**20,
        None,
        {},
    )


@pytest.fixture
def pkg(
    entry_with_hash: PackageEntry, entry_without_hash: PackageEntry, entry_without_hash_large: PackageEntry
) -> Package:
    p = Package()
    p.set("with-hash", entry_with_hash)
    p.set("without-hash", entry_without_hash)
    p.set("without-hash-large", entry_without_hash_large)
    return p


def test_calculate_pkg_hashes(
    pkg: Package,
    entry_without_hash: PackageEntry,
    entry_without_hash_large: PackageEntry,
    mocker: MockerFixture,
):
    calculate_pkg_entry_hash_mock = mocker.patch.object(
        t4_lambda_pkgpush, "calculate_pkg_entry_hash"
    )
    calculate_pkg_entry_hash_local_mock = mocker.patch.object(t4_lambda_pkgpush, "calculate_pkg_entry_hash_local")
    session_mock = boto3.Session(**CREDENTIALS.boto_args)

    with t4_lambda_pkgpush.setup_user_boto_session(session_mock):
        t4_lambda_pkgpush.calculate_pkg_hashes(pkg, SCRATCH_BUCKETS)

    calculate_pkg_entry_hash_mock.assert_called_once_with(
        entry_without_hash_large,
        CREDENTIALS,
        SCRATCH_BUCKETS,
    )
    calculate_pkg_entry_hash_local_mock.assert_called_once_with(
        entry_without_hash,
        mocker.ANY,
        SCRATCH_BUCKETS,
    )


def test_calculate_pkg_hashes_too_large_file_error(pkg: Package, mocker: MockerFixture):
    mocker.patch.object(t4_lambda_pkgpush, "S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES", 1)

    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as excinfo:
        t4_lambda_pkgpush.calculate_pkg_hashes(pkg, SCRATCH_BUCKETS)
    assert excinfo.value.name == "FileTooLargeForHashing"


def test_calculate_pkg_entry_hash(
    entry_without_hash: PackageEntry,
    mocker: MockerFixture,
):
    invoke_hash_lambda_mock = mocker.patch(
        "t4_lambda_pkgpush.invoke_hash_lambda",
        return_value=Checksum(type=ChecksumType.SHA256_CHUNKED, value="base64hash"),
    )

    t4_lambda_pkgpush.calculate_pkg_entry_hash(
        entry_without_hash,
        CREDENTIALS,
        SCRATCH_BUCKETS,
    )

    invoke_hash_lambda_mock.assert_called_once_with(
        entry_without_hash.physical_key,
        CREDENTIALS,
        SCRATCH_BUCKETS,
    )

    assert entry_without_hash.hash == invoke_hash_lambda_mock.return_value.dict()


def test_invoke_hash_lambda(lambda_stub: Stubber):
    checksum = {"type": "sha2-256-chunked", "value": "base64hash"}
    pk = PhysicalKey(bucket="bucket", path="path", version_id="version-id")

    lambda_stub.add_response(
        "invoke",
        service_response={
            "Payload": io.BytesIO(
                b'{"result": {"checksum": %s}}' % json.dumps(checksum).encode()
            ),
        },
        expected_params={
            "FunctionName": t4_lambda_pkgpush.S3_HASH_LAMBDA,
            "Payload": json.dumps(
                {
                    "credentials": {
                        "key": CREDENTIALS.key,
                        "secret": CREDENTIALS.secret,
                        "token": CREDENTIALS.token,
                    },
                    "scratch_buckets": SCRATCH_BUCKETS,
                    "location": {
                        "bucket": pk.bucket,
                        "key": pk.path,
                        "version": pk.version_id,
                    },
                }
            ),
        },
    )

    assert (
        t4_lambda_pkgpush.invoke_hash_lambda(pk, CREDENTIALS, SCRATCH_BUCKETS)
        == checksum
    )


def test_invoke_hash_lambda_error(lambda_stub: Stubber):
    pk = PhysicalKey(bucket="bucket", path="path", version_id="version-id")

    lambda_stub.add_response(
        "invoke",
        service_response={
            "FunctionError": "Unhandled",
            "Payload": io.BytesIO(
                b'{"errorMessage":"2024-02-02T14:33:39.754Z e0db9ea8-1329-44d5-a0dc-364ba2749b09'
                b' Task timed out after 1.00 seconds"}'
            ),
        },
        expected_params={
            "FunctionName": t4_lambda_pkgpush.S3_HASH_LAMBDA,
            "Payload": json.dumps(
                {
                    "credentials": {
                        "key": CREDENTIALS.key,
                        "secret": CREDENTIALS.secret,
                        "token": CREDENTIALS.token,
                    },
                    "scratch_buckets": SCRATCH_BUCKETS,
                    "location": {
                        "bucket": pk.bucket,
                        "key": pk.path,
                        "version": pk.version_id,
                    },
                }
            ),
        },
    )

    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as excinfo:
        t4_lambda_pkgpush.invoke_hash_lambda(pk, CREDENTIALS, SCRATCH_BUCKETS)
    assert excinfo.value.name == "S3HashLambdaUnhandledError"


@pytest.mark.parametrize(
    "chunked, expected",
    [
        (True, Checksum.sha256_chunked(base64.b64decode("WZ1xAz1wCsiSoOSPphsSXS9ZlBu0XaGQlETUPG7gurI="))),
        (False, Checksum.sha256(base64.b64decode("MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g="))),
    ],
)
def test_calculate_pkg_entry_hash_local(
    entry_without_hash: PackageEntry,
    mocker: MockerFixture,
    chunked: bool,
    expected: Checksum,
):
    mocker.patch("t4_lambda_pkgpush.CHUNKED_CHECKSUMS", chunked)
    get_bucket_region_mock = mocker.patch("t4_lambda_pkgpush.get_bucket_region", return_value=SCRATCH_REGION)
    make_scratch_key_mock = mocker.patch("t4_lambda_pkgpush.make_scratch_key", return_value=SCRATCH_KEY)
    s3_client = boto3.client("s3")

    with Stubber(s3_client) as stubber:
        stubber.add_response(
            "copy_object",
            expected_params={
                "Bucket": SCRATCH_BUCKET,
                "CopySource": {
                    "Bucket": entry_without_hash.physical_key.bucket,
                    "Key": entry_without_hash.physical_key.path,
                    "VersionId": entry_without_hash.physical_key.version_id,
                },
                "Key": make_scratch_key_mock.return_value,
                "ChecksumAlgorithm": "SHA256",
            },
            service_response={
                "CopyObjectResult": {
                    "ChecksumSHA256": "MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g=",
                },
            },
        )

        t4_lambda_pkgpush.calculate_pkg_entry_hash_local(
            entry_without_hash,
            s3_client,
            SCRATCH_BUCKETS,
        )

    get_bucket_region_mock.assert_called_once_with(entry_without_hash.physical_key.bucket)
    make_scratch_key_mock.assert_called_once_with()
    stubber.assert_no_pending_responses()

    assert entry_without_hash.hash == expected
