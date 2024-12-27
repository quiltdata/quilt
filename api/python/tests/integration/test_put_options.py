import pathlib
import boto3

from botocore.exceptions import ClientError
from pytest import raises

from quilt3 import Bucket

DATA_DIR = pathlib.Path(__file__).parent / 'data'
TEST_BUCKET_NAME = "test-kms-policies"
TEST_BUCKET = f"s3://{TEST_BUCKET_NAME}"
TEST_FILE = "foo.txt"
TEST_SRC = f"{DATA_DIR / TEST_FILE}"

print(f"TEST_BUCKET: {TEST_BUCKET}")
print(f"TEST_SRC: {TEST_SRC}")


def dest_key(test_name):
    return f"test/{test_name}/{TEST_FILE}"


def test_bucket_put_file():
    dest = dest_key("test_bucket_put_file")
    print(f"DEST: {dest}")
    bucket = Bucket(TEST_BUCKET)

    with raises(ClientError,
                match="An error occurred \(AccessDenied\) when calling "
                "the PutObject operation:.*"):
        bucket.put_file(dest, TEST_SRC)

    bucket.put_file(dest, TEST_SRC,
                    put_options={"ServerSideEncryption": "aws:kms"})

    # Use boto3 to verify the object was uploaded with the correct encryption
    s3 = boto3.client('s3')
    response = s3.head_object(Bucket=TEST_BUCKET_NAME, Key=dest)
    assert response['ServerSideEncryption'] == 'aws:kms'

    # Use boto3 to clean up
    s3.delete_object(Bucket=TEST_BUCKET_NAME, Key=dest)
