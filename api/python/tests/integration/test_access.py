from datetime import datetime
import os
import pytest

import boto3
import quilt3 as q3
from quilt3.data_transfer import S3ClientProvider, list_object_versions
from tests.utils import QuiltTestCase

NOW = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
BKT = "850787717197-1867753-fepwgrx9iujr5b9pkjudkhpgxwbuhuse1b-s3alias"
REG = f"s3://{BKT}"
FOLDER = "850787717197/sequenceStore/1867753048/readSet/5447294294"
FILE = "U0a_CGATGT_L001_R1_004.fastq.gz"
KEY = f"{FOLDER}/{FILE}"


class AccessTest(QuiltTestCase):

    def setUp(self):
        super().setUp()
        self.session = boto3.Session(profile_name="sales")
        self.s3 = self.session.client("s3")

    def test_boto3_access(self):
        head_object = self.s3.head_object(Bucket=BKT, Key=KEY)
        assert head_object
        print(f"head_object: {head_object}")
        get_object = self.s3.get_object(Bucket=BKT, Key=KEY)
        print(f"get_object: {get_object}")
        list_bucket = self.s3.list_objects(Bucket=BKT, Prefix=FOLDER)
        print(f"list_bucket: {list_bucket}")

    def test_list_object_versions(self):
        print(f"test_list_object_versions for REG: {REG}")
        versions = list_object_versions(REG, FOLDER+"/", False)
        print(f"versions: {versions}")
        assert versions

    def test_package(self):
        # /Users/ernest/GitHub/quilt/api/python/quilt3/workflows/__init__.py:297: in validate

        uri = f"{REG}/{KEY}"
        split = FOLDER.split("/")
        pkg_name = f"{split[-2]}/{split[-1]}"
        msg = f"Today's Date: {NOW}"

        pkg = q3.Package()
        try:
            pkg = pkg.browse(pkg_name, registry=REG)
        except Exception as e:
            print(f"Error browsing package: {e}")
        print(f"Package: {pkg}")

        print(f"S3 URI: {uri} @ {msg}")
        pkg.set_dir("/", uri, meta={"timestamp": NOW})

        print(f"Package.push: {pkg_name}")
        rc = pkg.push(pkg_name, registry=REG, message=msg)
        assert rc

        PKG_URI = f"quilt+{REG}#package={pkg_name}"
        print(f"Package {pkg_name} pushed to {REG}: {PKG_URI}")

    @pytest.mark.skip(reason="Not sure this is needed")
    def test_bucket(self):
        registry = REG
        path = KEY
        os.environ["AWS_PROFILE"] = "sales"
        client = getattr(S3ClientProvider(), "standard_client")
        print(f"client: {client.meta.config.signature_version}")
        bucket = q3.Bucket(registry)
        print(f"bucket: {bucket}")
        full_path = f"{registry}/{path}"
        print(f"path: {full_path}")
        bucket.fetch(full_path, "./data")
