from tests.utils import QuiltTestCase
import pathlib

from quilt3 import Bucket, Package

DATA_DIR = pathlib.Path(__file__).parent / 'data'

class TestPutOptions(QuiltTestCase):
    TEST_BUCKET = "s3://test-kms-policies"
    TEST_FILE = "foo.txt"
    TEST_SRC = f"{DATA_DIR / TEST_FILE}"

    def dest_file(self, test_name):
        return f"{self.TEST_BUCKET}/test/{test_name}"

    def test_bucket_put_file(self):
        print(f"TEST_BUCKET: {self.TEST_BUCKET}")
        print(f"TEST_SRC: {self.TEST_SRC}")
        bucket = Bucket(self.TEST_BUCKET)
        bucket.put_file(self.TEST_SRC, self.dest_file("test_bucket_put_file"))

    
