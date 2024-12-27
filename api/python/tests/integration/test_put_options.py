import pathlib
from quilt3 import Bucket

DATA_DIR = pathlib.Path(__file__).parent / 'data'
TEST_BUCKET = "s3://test-kms-policies"
TEST_FILE = "foo.txt"
TEST_SRC = f"{DATA_DIR / TEST_FILE}"

print(f"TEST_BUCKET: {TEST_BUCKET}")
print(f"TEST_SRC: {TEST_SRC}")

def dest_file(test_name):
    return f"{TEST_BUCKET}/test/{test_name}"

def test_bucket_put_file():
    dest = dest_file("test_bucket_put_file")
    print(f"DEST: {dest}")
    bucket = Bucket(TEST_BUCKET)

#    bucket.put_file(TEST_SRC, dest_file("test_bucket_put_file"))
    bucket.put_file(TEST_SRC,
                    dest_file("test_bucket_put_file"),
                    put_options={"ServerSideEncryption": "aws:kms"})
