import quilt3 as q3
from quilt3.data_transfer import S3ClientProvider
from datetime import datetime
import boto3
from tests.utils import QuiltTestCase

# venv/bin/python3 ./package-s3.py

NOW = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
BKT = "850787717197-1867753-fepwgrx9iujr5b9pkjudkhpgxwbuhuse1b-s3alias"
REG = f"s3://{BKT}"
FOLDER = "850787717197/sequenceStore/1867753048/readSet/5447294294"
FILE = "U0a_CGATGT_L001_R1_004.fastq.gz"
KEY = f"{FOLDER}/{FILE}"


class AccessTest(QuiltTestCase):
    def setup(self):
        boto3.setup_default_session(profile_name='sales')

    def test_boto3_access(self):
        s3 = boto3.client("s3")
        head_object = s3.head_object(Bucket=BKT, Key=KEY)
        print(f"head_object: {head_object}")
        get_object = s3.get_object(Bucket=BKT, Key=KEY)
        print(f"get_object: {get_object}")
        list_bucket = s3.list_objects(Bucket=BKT, Prefix=FOLDER)
        print(f"list_bucket: {list_bucket}")

    def test_bucket(self):
        registry = REG
        path = KEY
        client = getattr(S3ClientProvider(), "standard_client")
        print(f"client: {client.meta.config.signature_version}")
        bucket = q3.Bucket(registry)
        print(f"bucket: {bucket}")
        full_path = f"{registry}/{path}"
        print(f"path: {full_path}")
        bucket.fetch(full_path, "./data")
