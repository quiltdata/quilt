import json
import pathlib
from io import BytesIO
from unittest.mock import ANY, patch

from botocore.exceptions import ClientError

from quilt3 import Bucket, Package
from quilt3.data_transfer import PhysicalKey
from quilt3.packages import PackageEntry

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
SUB_HASH = "e885f8bed32d1bdb889b42f4ea9f62c1c095c501e748573fa30896be06120ab"


def dest_dir(test_name):
    return f"test/{test_name}"


def dest_key(test_name):
    return f"{dest_dir(test_name)}/{TEST_FILE}"

class MockEntry:
    def __init__(self, test_name_fetch):
        self.pkg_src = dest_dir("test_package_push")
        self.pkg_dest = dest_dir(test_name_fetch)
        self.uri_src = f"{TEST_URI}/{self.pkg_src}/{TEST_FILE}"
        self.uri_dest = f"{TEST_URI}/{self.pkg_dest}/"
        self.key_src = PhysicalKey.from_url(self.uri_src)
        self.hash_obj = {"type": "SHA256", "value": "2" + SUB_HASH}
        self.pkg_entry = PackageEntry(
            physical_key=self.key_src,
            size=123,
            hash_obj=self.hash_obj,
            meta={},
        )

    def copy_args(self, parent):
        args = parent.mock_call_args(f"{self.pkg_dest}/{TEST_FILE}")
        args.pop("Body")
        args["CopySource"] = {
            "Bucket": TEST_BUCKET,
            "Key": f"{self.pkg_src}/{TEST_FILE}",
            "VersionId": "test-version-id",
        }
        return args

    def upload_args(self, parent):
        args = parent.mock_call_args(f"{self.pkg_dest}/{TEST_FILE}")
        args.pop("Body")
        return args


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
            "ContentLength": 123,
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
    def mock_copy_object_side_effect(cls, Bucket, Key, **kwargs):
        if kwargs.get("ServerSideEncryption") == "aws:kms":
            body = cls.mock_get_object_side_effect(Bucket, Key, "EmptyBody")
            return {
                "CopyObjectResult": body,
                "CopySourceVersionId": "test-version-id",
                "UploadId": "test-upload-id",
            }
        else:
            raise ClientError({"Error": {"Code": "AccessDenied", "Message": "Access Denied"}}, "CopyObject")

    @classmethod
    def mock_list_objects_side_effect(cls, Bucket, Prefix, **kwargs):
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
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.get_object")
    def test_package_push(self, mock_get_object,
                          mock_put_object, mock_list_objects):
        """Package push !mpu -> put_object"""
        # TODO: Add test for mpu -> upload_part
        mock_get_object.side_effect = self.mock_get_object_side_effect
        mock_put_object.side_effect = self.mock_put_object_side_effect
        mock_list_objects.side_effect = self.mock_list_objects_side_effect

        pkg_name = dest_dir("test_package_push")
        pkg = Package()
        pkg.set(TEST_FILE, TEST_SRC)

        with self.assertRaises(ClientError, msg=ERR_MSG):
            pkg.build(pkg_name, TEST_URI)

        with self.assertRaises(ClientError, msg=ERR_MSG):
            pkg.push(pkg_name, TEST_URI, force=True)

        pkg.build(pkg_name, TEST_URI, put_options=USE_KMS)
        pkg.push(pkg_name, TEST_URI, put_options=USE_KMS, force=True)

        args = {
            "Body": b'2e885f8bed32d1bdb889b42f4ea9f62c1c095c501e748573fa30896be06120ab',
            "Bucket": TEST_BUCKET,
            "Key": f".quilt/named_packages/{pkg_name}/latest",
            "ServerSideEncryption": "aws:kms",
        }
        mock_put_object.assert_called_with(**args)

    @patch("quilt3.data_transfer.is_mpu")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.list_objects_v2")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.copy_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.get_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.head_object")
    def test_package_entry_fetch(self, mock_head_object, mock_get_object, mock_copy_object, mock_list_objects, mock_is_mpu):
        """_copy_remote_file !mpu -> copy_object"""
        mock_head_object.side_effect = self.mock_get_object_side_effect
        mock_get_object.side_effect = self.mock_get_object_side_effect
        mock_copy_object.side_effect = self.mock_copy_object_side_effect
        mock_list_objects.side_effect = self.mock_list_objects_side_effect

        mock_entry = MockEntry("test_package_entry_fetch")
        pkg_entry = mock_entry.pkg_entry
        uri_dest = mock_entry.uri_dest

        mock_is_mpu.return_value = False

        with self.assertRaises(ClientError, msg=COPY_MSG):
            pkg_entry.fetch(uri_dest)

        new_entry = pkg_entry.fetch(uri_dest, put_options=USE_KMS)
        assert new_entry is not None
        copy_args = mock_entry.copy_args(self)

        mock_copy_object.assert_called_with(**copy_args)

    @patch("quilt3.data_transfer.is_mpu")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.list_objects_v2")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.get_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.head_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.create_multipart_upload")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.upload_part_copy")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.complete_multipart_upload")
    def test_package_entry_fetch_mpu(
        self, mock_complete_mpu, mock_upload_part, mock_create_mpu,
        mock_head_object, mock_get_object, mock_list_objects, mock_is_mpu
    ):
        """_copy_remote_file mpu -> create_multipart_upload"""
        mock_complete_mpu.return_value = {
            "Location": "test-location",
            "VersionId": "test-version-id",
            "ChecksumSHA256": "test-checksum-sha256",
        }
        mock_upload_part.return_value = {
            "CopyPartResult": {"ETag": "test-etag", "ChecksumSHA256": "test-checksum-sha256"},
            "CopySourceVersionId": "test-version-id",
        }
        mock_create_mpu.side_effect = self.mock_copy_object_side_effect
        mock_head_object.side_effect = self.mock_get_object_side_effect
        mock_get_object.side_effect = self.mock_get_object_side_effect
        mock_list_objects.side_effect = self.mock_list_objects_side_effect

        mock_is_mpu.return_value = True

        mock_entry = MockEntry("test_package_entry_fetch_mpu")
        pkg_entry = mock_entry.pkg_entry
        uri_dest = mock_entry.uri_dest

        with self.assertRaises(ClientError, msg=COPY_MSG):
            pkg_entry.fetch(uri_dest)

        new_entry = pkg_entry.fetch(uri_dest, put_options=USE_KMS)
        assert new_entry is not None
        upload_args = mock_entry.upload_args(self)

        mock_create_mpu.assert_called_with(**upload_args)
