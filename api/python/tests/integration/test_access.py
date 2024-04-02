from datetime import datetime
import pytest

import boto3
import quilt3 as q3
from quilt3.data_transfer import list_object_versions

NOW = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
BKT = "850787717197-1867753-fepwgrx9iujr5b9pkjudkhpgxwbuhuse1b-s3alias"
SOURCE = f"s3://{BKT}"
DEST = "s3://quilt-sales-staging"
FOLDER = "850787717197/sequenceStore/1867753048/readSet/5447294294"
FILE = "U0a_CGATGT_L001_R1_004.fastq.gz"
KEY = f"{FOLDER}/{FILE}"


@pytest.fixture(autouse=True)
def client():
    session = boto3.Session(profile_name="sales")
    return session.client("s3")


def test_boto3_access(client):
    head_object = client.head_object(Bucket=BKT, Key=KEY)
    assert head_object
    print(f"head_object: {head_object}")
    get_object = client.get_object(Bucket=BKT, Key=KEY)
    print(f"get_object: {get_object}")
    list_bucket = client.list_objects(Bucket=BKT, Prefix=FOLDER)
    print(f"list_bucket: {list_bucket}")


def test_list_object_versions(client):
    print(f"test_list_object_versions for SOURCE: {SOURCE}")
    versions = list_object_versions(SOURCE, FOLDER+"/", False)
    print(f"versions: {versions}")
    assert versions


def test_package(client):
    uri = f"{SOURCE}/{KEY}"
    split = FOLDER.split("/")
    pkg_name = f"{split[-2]}/{split[-1]}"
    msg = f"Today's Date: {NOW}"

    pkg = q3.Package()
    try:
        pkg = pkg.browse(pkg_name, registry=DEST)
    except Exception as e:
        print(f"Error browsing package: {e}")
    print(f"Package: {pkg}")

    print(f"S3 URI: {uri} @ {msg}")
    pkg.set_dir("/", uri, meta={"timestamp": NOW})

    PKG_URI = f"quilt+{DEST}#package={pkg_name}"
    print(f"Pushing {pkg_name} to {DEST}: {PKG_URI}")
    rc = pkg.push(pkg_name, registry=DEST, message=msg, force=True)
    assert rc
