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
from quilt_shared.pkgpush import Checksum, ChecksumAlgorithm, ChecksumType
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
        PhysicalKey("test-bucket", "without-hash-large", "without-hash-large"),
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
    """Test calculate_pkg_hashes orchestrates small file copy and large file lambda invocations"""
    checksum_algorithms = [ChecksumAlgorithm.SHA256_CHUNKED]

    session_mock = boto3.Session(**CREDENTIALS.boto_args)

    # Mock SHA256_CHUNKED compliance check to return None (not compliant/available)
    # Note: CRC64NVME is not checked here - already done in complete_entries_metadata
    mocker.patch.object(t4_lambda_pkgpush, "try_get_compliant_sha256_chunked", return_value=None)

    # Mock the computation functions
    compute_via_copy_mock = mocker.patch.object(t4_lambda_pkgpush, "compute_checksum_via_copy")
    compute_via_copy_mock.return_value = Checksum.sha256_chunked(b"small_hash")

    invoke_hash_lambda_mock = mocker.patch.object(t4_lambda_pkgpush, "invoke_hash_lambda")
    invoke_hash_lambda_mock.return_value = Checksum.sha256_chunked(b"large_hash")

    with t4_lambda_pkgpush.setup_user_boto_session(session_mock):
        t4_lambda_pkgpush.calculate_pkg_hashes(pkg, SCRATCH_BUCKETS, checksum_algorithms)

    # Verify small file was processed via copy_object
    assert compute_via_copy_mock.call_count == 1
    # Verify large file was processed via s3hash lambda
    assert invoke_hash_lambda_mock.call_count == 1
    # Verify hashes were set
    assert entry_without_hash.hash is not None
    assert entry_without_hash_large.hash is not None


def test_calculate_pkg_hashes_too_large_file_error(pkg: Package, mocker: MockerFixture):
    """Test that files exceeding max size raise error"""
    checksum_algorithms = [ChecksumAlgorithm.SHA256_CHUNKED]
    mocker.patch.object(t4_lambda_pkgpush, "S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES", 1)

    session_mock = boto3.Session(**CREDENTIALS.boto_args)

    # Mock SHA256_CHUNKED compliance check to force computation
    mocker.patch.object(t4_lambda_pkgpush, "try_get_compliant_sha256_chunked", return_value=None)

    with t4_lambda_pkgpush.setup_user_boto_session(session_mock):
        with pytest.raises(t4_lambda_pkgpush.PkgpushException) as excinfo:
            t4_lambda_pkgpush.calculate_pkg_hashes(pkg, SCRATCH_BUCKETS, checksum_algorithms)

    assert excinfo.value.name == "FileTooLargeForHashing"


def test_invoke_hash_lambda(lambda_stub: Stubber):
    """Test invoke_hash_lambda calls S3_HASH_LAMBDA with correct parameters"""
    checksum = {"type": "CRC64NVME", "value": "base64hash"}
    pk = PhysicalKey(bucket="bucket", path="path", version_id="version-id")

    lambda_stub.add_response(
        "invoke",
        service_response={
            "Payload": io.BytesIO(b'{"result": {"checksum": %s}}' % json.dumps(checksum).encode()),
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
                    "checksum_algorithm": "CRC64NVME",
                }
            ),
        },
    )

    result = t4_lambda_pkgpush.invoke_hash_lambda(pk, CREDENTIALS, SCRATCH_BUCKETS, ChecksumAlgorithm.CRC64NVME)
    assert result == Checksum(**checksum)


def test_invoke_hash_lambda_error(lambda_stub: Stubber):
    """Test invoke_hash_lambda handles lambda errors"""
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
                    "checksum_algorithm": "SHA256_CHUNKED",
                }
            ),
        },
    )

    with pytest.raises(t4_lambda_pkgpush.PkgpushException) as excinfo:
        t4_lambda_pkgpush.invoke_hash_lambda(pk, CREDENTIALS, SCRATCH_BUCKETS, ChecksumAlgorithm.SHA256_CHUNKED)
    assert excinfo.value.name == "S3HashLambdaUnhandledError"


def test_compute_checksum_via_copy(mocker: MockerFixture):
    """Test compute_checksum_via_copy uses copy_object with correct ChecksumAlgorithm"""
    pk = PhysicalKey(bucket="test-bucket", path="test-key", version_id="test-version")
    expected_checksum = Checksum.crc64nvme(base64.b64decode("MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g="))

    get_bucket_region_mock = mocker.patch("t4_lambda_pkgpush.get_bucket_region", return_value=SCRATCH_REGION)
    make_scratch_key_mock = mocker.patch("t4_lambda_pkgpush.make_scratch_key", return_value=SCRATCH_KEY)
    s3_client = boto3.client("s3")

    with Stubber(s3_client) as stubber:
        stubber.add_response(
            "copy_object",
            expected_params={
                "Bucket": SCRATCH_BUCKET,
                "CopySource": {
                    "Bucket": pk.bucket,
                    "Key": pk.path,
                    "VersionId": pk.version_id,
                },
                "Key": SCRATCH_KEY,
                "ChecksumAlgorithm": "CRC64NVME",
            },
            service_response={
                "CopyObjectResult": {
                    "ChecksumCRC64NVME": "MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g=",
                },
            },
        )

        result = t4_lambda_pkgpush.compute_checksum_via_copy(
            s3_client,
            pk,
            SCRATCH_BUCKETS,
            ChecksumAlgorithm.CRC64NVME,
        )

    get_bucket_region_mock.assert_called_once_with(pk.bucket)
    make_scratch_key_mock.assert_called_once_with()
    stubber.assert_no_pending_responses()

    assert result == expected_checksum
