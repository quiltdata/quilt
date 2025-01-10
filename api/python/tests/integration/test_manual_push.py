import pathlib

import boto3
from botocore.exceptions import ClientError
from pytest import raises

from quilt3 import Bucket, Package, delete_package
from quilt3.data_transfer import S3ClientProvider

DATA_DIR = pathlib.Path(__file__).parent / 'data'
TEST_BUCKET = "test-kms-policies"
TEST_BUCKET_URI = f"s3://{TEST_BUCKET}"
TEST_FILE = "fubar.bin"
TEST_SRC = f"{DATA_DIR / TEST_FILE}"

S3_BUCKET = Bucket(TEST_BUCKET_URI)
S3_CLIENT = boto3.client('s3')
USE_KMS = {"ServerSideEncryption": "aws:kms"}

print(f"TEST_BUCKET: {S3_BUCKET}")
print(f"TEST_SRC: {TEST_SRC}")


def dest_dir(test_name):
    return f"test/{test_name}"


def dest_key(test_name):
    return f"{dest_dir(test_name)}/{TEST_FILE}"


def test_package_push_mpu():
    should_delete = True
    pkg_name = dest_dir("test_package_push_mpu")
    dest_file = dest_key("test_package_push_mpu")
    print(f"test_package_push_mpu.pkg_name: {pkg_name}")

    pkg = Package()
    pkg.set(TEST_FILE, TEST_SRC)

    with raises(
        ClientError, 
        match=r"An error occurred \(AccessDenied\) when calling the CreateMultipartUpload operation:.*"
    ):
        pkg.push(pkg_name, TEST_BUCKET_URI, force=True)

    S3ClientProvider().register_event_options("provide-client-params.s3.PutObject", **USE_KMS)
    pkg.push(pkg_name, TEST_BUCKET_URI, force=True)

    # Use boto3 to verify the object was uploaded with the correct encryption
    response = S3_CLIENT.head_object(Bucket=TEST_BUCKET, Key=dest_file)
    assert response['ServerSideEncryption'] == 'aws:kms'

    # Read package entry
    pkg2 = Package.browse(pkg_name, registry=TEST_BUCKET_URI)
    assert TEST_FILE in pkg2
    pkg_entry = pkg2.get(TEST_FILE)
    assert pkg_entry is not None

    # Cleanup
    if should_delete:
        delete_package(pkg_name, registry=TEST_BUCKET_URI)
        S3_CLIENT.delete_object(Bucket=TEST_BUCKET, Key=dest_file)
        S3_CLIENT.delete_object(Bucket=TEST_BUCKET, Key=pkg_name+"/")
