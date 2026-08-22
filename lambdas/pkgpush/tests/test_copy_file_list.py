from unittest import mock

import boto3

import t4_lambda_pkgpush
from quilt3.util import PhysicalKey
from quilt_shared.pkgpush import ChecksumAlgorithm


@mock.patch("t4_lambda_pkgpush.S3_COPY_LAMBDA_CONCURRENCY", 1)
def test_copy_file_list():
    BUCKET = "bucket"
    VERSION_ID = "version-id"
    CHECKSUM_ALGORITHM = ChecksumAlgorithm.SHA256_CHUNKED
    CREDENTIALS = t4_lambda_pkgpush.AWSCredentials(
        key="a",
        secret="b",
        token="c",
    )
    ENTRIES = [
        ("a", 4),
        ("b", 5),
        ("c", 1),
    ]
    ENTRIES = {
        key: {
            "src": PhysicalKey(BUCKET, key, "src-version"),
            "dst": PhysicalKey(BUCKET, key, None),
            "result": PhysicalKey(BUCKET, key, VERSION_ID),
            "size": size,
        }
        for key, size in ENTRIES
    }

    # Setup boto session
    session_mock = boto3.Session(**CREDENTIALS.boto_args)

    with mock.patch("t4_lambda_pkgpush.invoke_copy_lambda", return_value=VERSION_ID) as invoke_copy_lambda_mock:
        with t4_lambda_pkgpush.setup_user_boto_session(session_mock):
            # copy_file_list now takes checksum_algorithm and returns a function
            copy_fn = t4_lambda_pkgpush.copy_file_list(CHECKSUM_ALGORITHM)

            # Check results has the same order as in supplied list.
            # copy_file_list now returns tuples of (versioned_key, checksum) for quilt3 7.x
            assert copy_fn([(e["src"], e["dst"], e["size"]) for e in ENTRIES.values()]) == [
                (e["result"], None) for e in ENTRIES.values()
            ]
            # Check that larger files are processed first.
            assert invoke_copy_lambda_mock.call_args_list == [
                mock.call(
                    CREDENTIALS,
                    e["src"],
                    e["dst"],
                    CHECKSUM_ALGORITHM,
                )
                for e in map(ENTRIES.__getitem__, ["b", "a", "c"])
            ]
