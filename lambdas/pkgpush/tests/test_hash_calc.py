import io
import json
import unittest
from unittest import mock

import boto3
import pytest
from botocore.stub import Stubber

import quilt_shared.aws
import t4_lambda_pkgpush
from quilt3.packages import Package, PackageEntry
from quilt3.util import PhysicalKey
from quilt_shared.pkgpush import Checksum, ChecksumType
from quilt_shared.types import NonEmptyStr


CREDENTIALS = quilt_shared.aws.AWSCredentials(
    key=NonEmptyStr("test_aws_access_key_id"),
    secret=NonEmptyStr("test_aws_secret_access_key"),
    token=NonEmptyStr("test_aws_session_token"),
)

SCRATCH_BUCKETS = {"us-east-1": "test-scratch-bucket"}


class HashCalculationTest(unittest.TestCase):
    def setUp(self):
        self.pkg = Package()
        self.entry_with_hash = PackageEntry(
            PhysicalKey("test-bucket", "with-hash", "with-hash"),
            42,
            {"type": "SHA256", "value": "0" * 64},
            {},
        )
        self.entry_without_hash = PackageEntry(
            PhysicalKey("test-bucket", "without-hash", "without-hash"),
            42,
            None,
            {},
        )
        self.pkg.set("with-hash", self.entry_with_hash)
        self.pkg.set("without-hash", self.entry_without_hash)

    def test_calculate_pkg_hashes(self):
        with mock.patch.object(
            t4_lambda_pkgpush, "calculate_pkg_entry_hash"
        ) as calculate_pkg_entry_hash_mock:
            session_mock = boto3.Session(**CREDENTIALS.boto_args)
            with t4_lambda_pkgpush.setup_user_boto_session(session_mock):
                t4_lambda_pkgpush.calculate_pkg_hashes(self.pkg, SCRATCH_BUCKETS)

        calculate_pkg_entry_hash_mock.assert_called_once_with(
            self.entry_without_hash,
            CREDENTIALS,
            SCRATCH_BUCKETS,
        )

    @mock.patch.object(t4_lambda_pkgpush, "S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES", 1)
    def test_calculate_pkg_hashes_too_large_file_error(self):
        with pytest.raises(t4_lambda_pkgpush.PkgpushException) as excinfo:
            t4_lambda_pkgpush.calculate_pkg_hashes(self.pkg, SCRATCH_BUCKETS)
        assert excinfo.value.name == "FileTooLargeForHashing"

    def test_calculate_pkg_entry_hash(self):
        with mock.patch(
            "t4_lambda_pkgpush.invoke_hash_lambda",
            return_value=Checksum(type=ChecksumType.SHA256_CHUNKED, value="base64hash"),
        ) as invoke_hash_lambda_mock:
            t4_lambda_pkgpush.calculate_pkg_entry_hash(
                self.entry_without_hash, CREDENTIALS, SCRATCH_BUCKETS
            )

        invoke_hash_lambda_mock.assert_called_once_with(
            self.entry_without_hash.physical_key,
            CREDENTIALS,
            SCRATCH_BUCKETS,
        )

        assert (
            self.entry_without_hash.hash == invoke_hash_lambda_mock.return_value.dict()
        )

    def test_invoke_hash_lambda(self):
        lambda_client_stubber = Stubber(t4_lambda_pkgpush.lambda_)
        lambda_client_stubber.activate()
        self.addCleanup(lambda_client_stubber.deactivate)
        checksum = {"type": "sha2-256-chunked", "value": "base64hash"}
        pk = PhysicalKey(bucket="bucket", path="path", version_id="version-id")

        lambda_client_stubber.add_response(
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
        lambda_client_stubber.assert_no_pending_responses()

    def test_invoke_hash_lambda_error(self):
        lambda_client_stubber = Stubber(t4_lambda_pkgpush.lambda_)
        lambda_client_stubber.activate()
        self.addCleanup(lambda_client_stubber.deactivate)
        pk = PhysicalKey(bucket="bucket", path="path", version_id="version-id")

        lambda_client_stubber.add_response(
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
        lambda_client_stubber.assert_no_pending_responses()
