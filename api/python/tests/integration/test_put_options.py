import json
import pathlib
from io import BytesIO
from unittest.mock import ANY, patch

from botocore.exceptions import ClientError

from quilt3 import Bucket, Package
from quilt3.data_transfer import PhysicalKey, EventHandlers
from quilt3.packages import PackageEntry

from ..utils import QuiltTestCase

ERR_MSG = r"An error occurred \(AccessDenied\) when calling the PutObject operation:.*"
COPY_MSG = ERR_MSG.replace("PutObject", "CopyObject")
DATA_DIR = pathlib.Path(__file__).parent / "data"
TEST_BUCKET = "test-kms-policies"
TEST_URI = f"s3://{TEST_BUCKET}"
TEST_FILE = "foo.txt"
TEST_SRC = f"{DATA_DIR / TEST_FILE}"
USE_KMS = {"ServerSideEncryption": "aws:kms"}
S3_BUCKET = Bucket(TEST_URI)
HASHES = [
    "2e885f8bed32d1bdb889b42f4ea9f62c1c095c501e748573fa30896be06120ab",
    "5bedf4fcce4fbcf0dd15eb1b692ae304a2257f1f67f6cca576e79c5024fccb1f",
]


def dest_dir(test_name):
    return f"test/{test_name}"


class MockEntry:
    def __init__(self, test_name_fetch):
        self.pkg_src = dest_dir("test_package_push")
        self.pkg_dest = dest_dir(test_name_fetch)
        self.uri_src = f"{TEST_URI}/{self.pkg_src}/{TEST_FILE}"
        self.uri_dest = f"{TEST_URI}/{self.pkg_dest}/"
        self.key_src = PhysicalKey.from_url(self.uri_src)
        self.hash_obj = {"type": "SHA256", "value": HASHES[0]}
        self.pkg_entry = PackageEntry(
            physical_key=self.key_src,
            size=123,
            hash_obj=self.hash_obj,
            meta={},
        )

    def create_args(self, parent):
        args = parent.mock_call_args(f"{self.pkg_dest}/{TEST_FILE}")
        args.pop("Body")
        return args

    def copy_args(self, parent):
        args = self.create_args(parent)
        args["CopySource"] = {
            "Bucket": TEST_BUCKET,
            "Key": f"{self.pkg_src}/{TEST_FILE}",
            "VersionId": "test-version-id",
        }
        return args

    def upload_args(self, parent):
        args = self.copy_args(parent)
        args.pop("ServerSideEncryption")
        args.pop("ChecksumAlgorithm")
        args["UploadId"] = "test-upload-id"
        args["PartNumber"] = 1
        args["CopySourceRange"] = "bytes=0-122"
        return args

    def complete_args(self, parent):
        args = self.create_args(parent)
        args.pop("ServerSideEncryption")
        args.pop("ChecksumAlgorithm")
        args["UploadId"] = "test-upload-id"
        args["MultipartUpload"] = {
            "Parts": [{"PartNumber": 1, "ETag": "test-etag", "ChecksumSHA256": "test-checksum-sha256"}]
        }
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

    @staticmethod
    def update_client_params_for_call(call_name, params):
        event_name = f"provide-client-params.s3.{call_name}"
        handler = EventHandlers._event_handlers.get(event_name)
        if handler:
            handler(params)

    @classmethod
    def mock_put_object_side_effect(cls, Bucket, Key, Body, **kwargs):
        cls.update_client_params_for_call("PutObject", kwargs)
        if kwargs.get("ServerSideEncryption") == "aws:kms":
            return cls.mock_get_object_side_effect(Bucket, Key, Body)
        else:
            raise ClientError({"Error": {"Code": "AccessDenied", "Message": "Access Denied"}}, "PutObject")

    @classmethod
    def mock_copy_object_side_effect(cls, Bucket, Key, **kwargs):
        cls.update_client_params_for_call("CopyObject", kwargs)
        if kwargs.get("ServerSideEncryption") == "aws:kms":
            body = cls.mock_get_object_side_effect(Bucket, Key, "EmptyBody")
            return {
                "CopyObjectResult": body,
                "CopySourceVersionId": "test-version-id",
                "UploadId": "test-upload-id",
                "ETag": "test-etag",
                "ChecksumSHA256": "test-checksum-sha256",
            }
        else:
            raise ClientError({"Error": {"Code": "AccessDenied", "Message": "Access Denied"}}, "CopyObject")

    @classmethod
    def mock_list_objects_side_effect(cls, Bucket, Prefix, **kwargs):
        contents = [{"Key": f"{Prefix}{HASHES[i]}", "Size": i} for i in range(2)]
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

    def test_update_client_params_for_call(self):
        EventHandlers._event_handlers = {}
        params = {}
        self.update_client_params_for_call("PutObject", params)
        assert not params

        EventHandlers.register_event_options("provide-client-params.s3.PutObject", **USE_KMS)
        self.update_client_params_for_call("PutObject", params)
        assert params == USE_KMS

    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.put_object")
    def test_bucket_put_file(self, mock_put_object):
        EventHandlers.reset_event_handlers()
        dest = "test_bucket_put_file_dest_key"

        # Simulate AccessDenied error
        mock_put_object.side_effect = self.mock_put_object_side_effect

        # Test error handling when access is denied
        with self.assertRaises(ClientError, msg=ERR_MSG):
            S3_BUCKET.put_file(key=dest, path=TEST_SRC)

        # Retry with ServerSideEncryption
        EventHandlers.register_event_options("provide-client-params.s3.PutObject", **USE_KMS)
        S3_BUCKET.put_file(key=dest, path=TEST_SRC)

        mock_put_object.assert_called()

    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.upload_part")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.put_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.head_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.create_multipart_upload")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.copy_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.complete_multipart_upload")
    def test_bucket_put_dir(
        self, mock_complete_mpu, mock_create_mpu, mock_copy_object, mock_head_object, mock_put_object, mock_upload_part
    ):
        EventHandlers.reset_event_handlers()
        dest = dest_dir("test_bucket_put_dir")

        mock_complete_mpu.return_value = {"ETag": "test-etag", "ChecksumSHA256": "test-checksum-sha256"}
        mock_copy_object.side_effect = self.mock_copy_object_side_effect
        # mock_create_mpu.side_effect = self.mock_create_mpu_side_effect
        mock_head_object.side_effect = self.mock_get_object_side_effect
        mock_put_object.side_effect = self.mock_put_object_side_effect
        mock_upload_part.return_value = {"ETag": "test-etag", "ChecksumSHA256": "test-checksum-sha256"}

        with self.assertRaises(ClientError, msg=ERR_MSG):
            S3_BUCKET.put_dir(dest, DATA_DIR)

        EventHandlers.register_event_options("provide-client-params.s3.CopyObject", **USE_KMS)
        EventHandlers.register_event_options("provide-client-params.s3.PutObject", **USE_KMS)
        S3_BUCKET.put_dir(dest, DATA_DIR)

        mock_upload_part.assert_called()
        mock_head_object.assert_called()
        mock_put_object.assert_called()
        mock_copy_object.assert_called()
        # mock_create_mpu.assert_called()
        mock_complete_mpu.assert_called()

    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.put_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.list_objects_v2")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.get_object")
    def test_package_push(self, mock_get_object, mock_list_objects, mock_put_object):
        """Package push !mpu -> put_object"""
        EventHandlers.reset_event_handlers()
        mock_get_object.side_effect = self.mock_get_object_side_effect
        mock_list_objects.side_effect = self.mock_list_objects_side_effect
        mock_put_object.side_effect = self.mock_put_object_side_effect

        pkg_name = dest_dir("test_package_push")
        pkg = Package()
        pkg.set(TEST_FILE, TEST_SRC)

        with self.assertRaises(ClientError, msg=ERR_MSG):
            pkg.build(pkg_name, TEST_URI)

        with self.assertRaises(ClientError, msg=ERR_MSG):
            pkg.push(pkg_name, TEST_URI, force=True)

        EventHandlers.register_event_options("provide-client-params.s3.PutObject", **USE_KMS)
        pkg.build(pkg_name, TEST_URI)
        pkg.push(pkg_name, TEST_URI, force=True)

        mock_get_object.assert_called()
        mock_list_objects.assert_called()
        mock_put_object.assert_called()

    @patch("quilt3.data_transfer.is_mpu")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.head_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.copy_object")
    def test_package_entry_fetch(self, mock_copy_object, mock_head_object, mock_is_mpu):
        """_copy_remote_file !mpu -> copy_object"""
        EventHandlers.reset_event_handlers()
        mock_copy_object.side_effect = self.mock_copy_object_side_effect
        mock_head_object.side_effect = self.mock_get_object_side_effect
        mock_is_mpu.return_value = False

        mock_entry = MockEntry("test_package_entry_fetch")
        pkg_entry = mock_entry.pkg_entry
        uri_dest = mock_entry.uri_dest

        with self.assertRaises(ClientError, msg=COPY_MSG):
            pkg_entry.fetch(uri_dest)

        EventHandlers.register_event_options("provide-client-params.s3.CopyObject", **USE_KMS)
        new_entry = pkg_entry.fetch(uri_dest)
        assert new_entry is not None

        mock_copy_object.assert_called()
        mock_head_object.assert_called()
        mock_is_mpu.assert_called()

    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.upload_part")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.put_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.list_objects_v2")
    @patch("quilt3.data_transfer.is_mpu")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.get_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.create_multipart_upload")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.complete_multipart_upload")
    def test_package_push_mpu(
        self,
        mock_complete_mpu,
        mock_create_mpu,
        mock_get_object,
        mock_is_mpu,
        mock_list_objects,
        mock_put_object,
        mock_upload_part,
    ):
        """_copy_local_file mpu -> create_multipart_upload"""
        EventHandlers.reset_event_handlers()
        mock_complete_mpu.return_value = {
            "Location": "test-location",
            "VersionId": "test-version-id",
            "ChecksumSHA256": "test-checksum-sha256",
        }
        mock_create_mpu.side_effect = self.mock_copy_object_side_effect
        mock_get_object.side_effect = self.mock_get_object_side_effect
        mock_is_mpu.return_value = True
        mock_list_objects.side_effect = self.mock_list_objects_side_effect
        mock_put_object.side_effect = self.mock_put_object_side_effect
        mock_upload_part.return_value = {"ETag": "test-etag", "ChecksumSHA256": "test-checksum-sha256"}

        pkg_name = dest_dir("test_package_push_mpu")
        pkg = Package()
        pkg.set(TEST_FILE, TEST_SRC)

        with self.assertRaises(ClientError, msg=ERR_MSG):
            pkg.push(pkg_name, TEST_URI, force=True)

        EventHandlers.register_event_options("provide-client-params.s3.CopyObject", **USE_KMS)
        EventHandlers.register_event_options("provide-client-params.s3.PutObject", **USE_KMS)
        pkg.push(pkg_name, TEST_URI, force=True)

        mock_complete_mpu.assert_called()
        mock_create_mpu.assert_called()
        mock_get_object.assert_called()
        mock_is_mpu.assert_called()
        mock_list_objects.assert_called
        mock_upload_part.assert_called()

    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.upload_part_copy")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.list_objects_v2")
    @patch("quilt3.data_transfer.is_mpu")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.head_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.get_object")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.create_multipart_upload")
    @patch("quilt3.data_transfer.S3ClientProvider.standard_client.complete_multipart_upload")
    def test_package_entry_fetch_mpu(
        self,
        mock_complete_mpu,
        mock_create_mpu,
        mock_get_object,
        mock_head_object,
        mock_is_mpu,
        mock_list_objects,
        mock_upload_part,
    ):
        """_copy_remote_file mpu -> create_multipart_upload"""
        EventHandlers.reset_event_handlers()
        mock_complete_mpu.return_value = {
            "Location": "test-location",
            "VersionId": "test-version-id",
            "ChecksumSHA256": "test-checksum-sha256",
        }
        mock_create_mpu.side_effect = self.mock_copy_object_side_effect
        mock_get_object.side_effect = self.mock_get_object_side_effect
        mock_head_object.side_effect = self.mock_get_object_side_effect
        mock_is_mpu.return_value = True
        mock_list_objects.side_effect = self.mock_list_objects_side_effect
        mock_upload_part.return_value = {
            "CopyPartResult": {"ETag": "test-etag", "ChecksumSHA256": "test-checksum-sha256"},
            "CopySourceVersionId": "test-version-id",
        }

        mock_entry = MockEntry("test_package_entry_fetch_mpu")
        pkg_entry = mock_entry.pkg_entry
        uri_dest = mock_entry.uri_dest

        with self.assertRaises(ClientError, msg=COPY_MSG):
            pkg_entry.fetch(uri_dest)

        EventHandlers.register_event_options("provide-client-params.s3.CopyObject", **USE_KMS)
        new_entry = pkg_entry.fetch(uri_dest)
        assert new_entry is not None

        mock_complete_mpu.assert_called()
        mock_create_mpu.assert_called()
        # mock_get_object.assert_called()  -- called indirectly; causes error if not defined
        mock_head_object.assert_called()
        mock_is_mpu.assert_called()
        mock_list_objects.assert_called
        mock_upload_part.assert_called()
