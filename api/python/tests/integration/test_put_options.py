import json
import pathlib
from io import BytesIO
from unittest.mock import ANY, patch

from botocore.exceptions import ClientError

from quilt3 import Bucket, Package

from ..utils import QuiltTestCase

ERR_MSG = (
    r"An error occurred \(AccessDenied\)"
    r" when calling the PutObject operation:.*"
)
COPY_MSG = ERR_MSG.replace("PutObject", "CopyObject")
DATA_DIR = pathlib.Path(__file__).parent / "data"
TEST_BUCKET = "test-kms-policies"
TEST_URI = f"s3://{TEST_BUCKET}"
TEST_FILE = "foo.txt"
TEST_SRC = f"{DATA_DIR / TEST_FILE}"
USE_KMS = {"ServerSideEncryption": "aws:kms"}
S3_BUCKET = Bucket(TEST_URI)


def dest_dir(test_name):
    return f"test/{test_name}"


def dest_key(test_name):
    return f"{dest_dir(test_name)}/{TEST_FILE}"


class TestPutOptions(QuiltTestCase):

    @classmethod
    def body_bytes(cls) -> bytes:
        config = {
            "version": "1",
            "is_workflow_required": False,
            "workflows": {
                "alpha": {
                    "name": "Alpha",
                    "metadata_schema": "m",
                    "entries_schema": "e",
                }
            },
            "schemas": {
                "metadata-schema": {"url": "s3://bkt/.quilt/workflows/m.json"},
                "entries-schema": {"url": "s3://bkt/.quilt/workflows/e.json"},
            },
        }
        body = json.dumps(config)
        return bytes(body, "utf-8")

    @classmethod
    def mock_get_object_side_effect(cls, Bucket, Key, Body=None, **kwargs):
        return {
            "ETag": "test-etag",
            "Bucket": Bucket,
            "Key": Key,
            "Body": BytesIO(Body.encode() if isinstance(Body, str) else cls.body_bytes()),
            "VersionId": "test-version-id",
            "ChecksumSHA256": ("e039a2db15dc12e34534a0b338bbea13ecd848d76f970d594c730b3b754da64e"),
        }

    @classmethod
    def mock_put_object_side_effect(cls, Bucket, Key, Body, **kwargs):
        if kwargs.get("ServerSideEncryption") == "aws:kms":
            return cls.mock_get_object_side_effect(Bucket, Key, Body)
        else:
            raise ClientError(
                {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
                "PutObject"
            )

    @classmethod
    def mock_list_objects_side_effect(cls, Bucket, Prefix, **kwargs):
        SUB_HASH = "e885f8bed32d1bdb889b42f4ea9f62c1c095c501e748573fa30896be06120ab"
        contents = [{"Key": f"{Prefix}{i}{SUB_HASH}", "Size": i} for i in range(3)]
        return {
            "Contents": contents,
            "IsTruncated": True,
            "NextContinuationToken": None,
        }

    @staticmethod
    def mock_call_args(dest):
        return {
            "Body": ANY,
            "Bucket": TEST_BUCKET,
            "Key": dest,
            "ChecksumAlgorithm": "SHA256",
            "ServerSideEncryption": "aws:kms",
        }

    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.put_object")
    def test_bucket_put_file(self, mock_put_object):
        dest = "test_bucket_put_file_dest_key"

        # Simulate AccessDenied error
        mock_put_object.side_effect = self.mock_put_object_side_effect

        # Test error handling when access is denied
        with self.assertRaises(ClientError, msg=ERR_MSG):
            S3_BUCKET.put_file(key=dest, path=TEST_SRC)

        # Retry with ServerSideEncryption
        S3_BUCKET.put_file(key=dest, path=TEST_SRC, put_options=USE_KMS)

        # Verify the final call to the patched put_object method
        mock_put_object.assert_called_with(**self.mock_call_args(dest))

    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.put_object")
    def test_bucket_put_dir(self, mock_put_object):
        dest = dest_dir("test_bucket_put_dir")

        mock_put_object.side_effect = self.mock_put_object_side_effect

        with self.assertRaises(ClientError, msg=ERR_MSG):
            S3_BUCKET.put_dir(dest, DATA_DIR)

        S3_BUCKET.put_dir(dest, DATA_DIR, put_options=USE_KMS)

        args = self.mock_call_args(f"{dest}/{TEST_FILE}")
        mock_put_object.assert_any_call(**args)

    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.list_objects_v2")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.put_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.copy_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.get_object")
    def test_package_push(self, mock_get_object, mock_copy_object,
                          mock_put_object, mock_list_objects):
        pkg_name = dest_dir("test_package_push")

        pkg = Package()
        pkg.set(TEST_FILE, TEST_SRC)

        mock_put_object.side_effect = self.mock_put_object_side_effect
        mock_get_object.side_effect = self.mock_get_object_side_effect
        mock_list_objects.side_effect = self.mock_list_objects_side_effect

        with self.assertRaises(ClientError, msg=ERR_MSG):
            pkg.build(pkg_name, TEST_URI)

        with self.assertRaises(ClientError, msg=ERR_MSG):
            pkg.push(pkg_name, TEST_URI, force=True)

        pkg.build(pkg_name, TEST_URI, put_options=USE_KMS)
        pkg.push(pkg_name, TEST_URI, put_options=USE_KMS, force=True)
        print(f"Package[{pkg_name}]: {pkg}")

        args = {
            "Body": b'2e885f8bed32d1bdb889b42f4ea9f62c1c095c501e748573fa30896be06120ab',
            "Bucket": TEST_BUCKET,
            "Key": f".quilt/named_packages/{pkg_name}/latest",
            "ServerSideEncryption": "aws:kms",
        }
        mock_put_object.assert_called_with(**args)

        mock_copy_object.side_effect = self.mock_put_object_side_effect

        #
        # Test fetch entry to S3 directory
        #

        fetch_dir = dest_dir("test_package_entry_fetch")
        dest_uri = f"s3://{TEST_BUCKET}/{fetch_dir}/"
        pkg_entry = pkg[TEST_FILE]

        with self.assertRaises(ClientError, msg=COPY_MSG):
            pkg_entry.fetch(dest_uri)

        new_entry = pkg_entry.fetch(dest_uri, put_options=USE_KMS)
        assert new_entry is not None
        print(f"Entry[{new_entry}]: {new_entry}")

        args = self.mock_call_args(f"{fetch_dir}/{TEST_FILE}")
        mock_put_object.assert_called_with(**args)
