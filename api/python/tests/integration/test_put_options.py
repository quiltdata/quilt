import pathlib

import boto3
from botocore.exceptions import ClientError
from pytest import raises

from quilt3 import Bucket, Package

DATA_DIR = pathlib.Path(__file__).parent / 'data'
TEST_BUCKET = "test-kms-policies"
TEST_BUCKET_URI = f"s3://{TEST_BUCKET}"
S3_BUCKET = Bucket(TEST_BUCKET_URI)
TEST_FILE = "foo.txt"
TEST_SRC = f"{DATA_DIR / TEST_FILE}"

print(f"TEST_BUCKET: {S3_BUCKET}")
print(f"TEST_SRC: {TEST_SRC}")


def dest_dir(test_name):
    return f"test/{test_name}"


def dest_key(test_name):
    return f"{dest_dir(test_name)}/{TEST_FILE}"


def test_bucket_put_file():
    dest = dest_key("test_bucket_put_file")
    print(f"test_bucket_put_file.dest: {dest}")

    with raises(ClientError,
                match=r"An error occurred \(AccessDenied\) when calling "
                "the PutObject operation:.*"):
        S3_BUCKET.put_file(dest, TEST_SRC)

    S3_BUCKET.put_file(dest, TEST_SRC,
                       put_options={"ServerSideEncryption": "aws:kms"})

    # Use boto3 to verify the object was uploaded with the correct encryption
    s3 = boto3.client('s3')
    response = s3.head_object(Bucket=TEST_BUCKET, Key=dest)
    assert response['ServerSideEncryption'] == 'aws:kms'

    # Use boto3 to clean up
    s3.delete_object(Bucket=TEST_BUCKET, Key=dest)


def test_bucket_put_dir():
    dest = dest_dir("test_bucket_put_dir")
    print(f"test_bucket_put_dir.dest: {dest}")

    with raises(ClientError,
                match=r"An error occurred \(AccessDenied\) when calling "
                "the PutObject operation:.*"):
        S3_BUCKET.put_dir(dest, DATA_DIR)

    S3_BUCKET.put_dir(dest, DATA_DIR,
                      put_options={"ServerSideEncryption": "aws:kms"})

    # Use boto3 to verify the object was uploaded with the correct encryption
    s3 = boto3.client('s3')
    response = s3.head_object(Bucket=TEST_BUCKET,
                              Key=f"{dest}/{TEST_FILE}")
    assert response['ServerSideEncryption'] == 'aws:kms'

    # Use boto3 to remove directory and its contents
    response = s3.list_objects_v2(Bucket=TEST_BUCKET, Prefix=dest)
    for obj in response.get('Contents', []):
        s3.delete_object(Bucket=TEST_BUCKET, Key=obj['Key'])
    s3.delete_object(Bucket=TEST_BUCKET, Key=dest)


def test_package_push():
    pkg_name = dest_dir("test_package_push")
    print(f"test_package_push.pkg_name: {pkg_name}")

    pkg = Package()
    pkg.set(TEST_FILE, TEST_SRC)

    with raises(ClientError,
                match=r"An error occurred \(AccessDenied\) when calling "
                "the PutObject operation:.*"):
        pkg.push(pkg_name, TEST_BUCKET_URI)

    pkg.push(pkg_name, TEST_BUCKET_URI,
             put_options={"ServerSideEncryption": "aws:kms"})
