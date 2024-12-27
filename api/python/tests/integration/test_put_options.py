import pathlib

import boto3
from botocore.exceptions import ClientError
from pytest import raises
from tempfile import TemporaryDirectory

from quilt3 import Bucket, Package

ERR_MSG = r"An error occurred \(AccessDenied\) when calling the PutObject operation:.*"
DATA_DIR = pathlib.Path(__file__).parent / 'data'
TEST_BUCKET = "test-kms-policies"
TEST_BUCKET_URI = f"s3://{TEST_BUCKET}"
TEST_FILE = "foo.txt"
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


def test_bucket_put_file():
    dest = dest_key("test_bucket_put_file")
    print(f"test_bucket_put_file.dest: {dest}")

    with raises(ClientError, match=ERR_MSG):
        S3_BUCKET.put_file(dest, TEST_SRC)

    S3_BUCKET.put_file(dest, TEST_SRC, put_options=USE_KMS)

    # Use boto3 to verify the object was uploaded with the correct encryption
    response = S3_CLIENT.head_object(Bucket=TEST_BUCKET, Key=dest)
    assert response['ServerSideEncryption'] == 'aws:kms'

    # Use boto3 to clean up
    S3_CLIENT.delete_object(Bucket=TEST_BUCKET, Key=dest)


def test_bucket_put_dir():
    dest = dest_dir("test_bucket_put_dir")
    print(f"test_bucket_put_dir.dest: {dest}")

    with raises(ClientError, match=ERR_MSG):
        S3_BUCKET.put_dir(dest, DATA_DIR)

    S3_BUCKET.put_dir(dest, DATA_DIR, put_options=USE_KMS)

    # Use boto3 to verify the object was uploaded with the correct encryption
    response = S3_CLIENT.head_object(Bucket=TEST_BUCKET,
                              Key=f"{dest}/{TEST_FILE}")
    assert response['ServerSideEncryption'] == 'aws:kms'

    # Use boto3 to remove directory and its contents
    response = S3_CLIENT.list_objects_v2(Bucket=TEST_BUCKET, Prefix=dest)
    for obj in response.get('Contents', []):
        S3_CLIENT.delete_object(Bucket=TEST_BUCKET, Key=obj['Key'])
    S3_CLIENT.delete_object(Bucket=TEST_BUCKET, Key=dest)


def test_package_push():
    pkg_name = dest_dir("test_package_push")
    print(f"test_package_push.pkg_name: {pkg_name}")

    pkg = Package()
    pkg.set(TEST_FILE, TEST_SRC)

    with raises(ClientError, match=ERR_MSG):
        pkg.push(pkg_name, TEST_BUCKET_URI, force=True)

    pkg.push(pkg_name, TEST_BUCKET_URI, put_options=USE_KMS, force=True)

    # Use boto3 to verify the object was uploaded with the correct encryption
    response = S3_CLIENT.head_object(Bucket=TEST_BUCKET,
                                     Key=f"{pkg_name}/{TEST_FILE}")
    assert response['ServerSideEncryption'] == 'aws:kms'

    # Read package entry
    pkg2 = Package.browse(pkg_name, registry=TEST_BUCKET_URI)
    assert TEST_FILE in pkg2
    pkg_entry = pkg2[TEST_FILE]
    print(f"pkg_entry: {pkg_entry}")
    assert pkg_entry is not None

    # fetch to temp location in S3 bucket
    fetch_dir = dest_dir("test_package_fetch")
    dest_uri = f"s3://{TEST_BUCKET}/{fetch_dir}"
    with raises(ClientError, match=ERR_MSG):
        pkg_entry.fetch(dest_uri)

    new_entry = pkg_entry.fetch(dest_uri, put_options=USE_KMS)
    assert new_entry is not None

    # Use boto3 to verify the object was uploaded with the correct encryption
    response = S3_CLIENT.head_object(Bucket=TEST_BUCKET,
                                     Key=f"{fetch_dir}/{TEST_FILE}")
    assert response['ServerSideEncryption'] == 'aws:kms'

    # Cleanup
    # pkg.delete(pkg_name)
    # S3_CLIENT.delete_object(Bucket=TEST_BUCKET, Key=f"{fetch_dir}")
    # S3_CLIENT.delete_object(Bucket=TEST_BUCKET, Key=f"{pkg_name}/")
