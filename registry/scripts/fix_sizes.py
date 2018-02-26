#!/usr/bin/env python3

"""
Backfills S3Blob.size for all of the objects in S3.

We store sizes of the original content, so we need to download the data and ungzip it.
"""

import gzip

from botocore.exceptions import ClientError

from quilt_server import db
from quilt_server.models import S3Blob
from quilt_server.views import s3_client, PACKAGE_BUCKET_NAME, OBJ_DIR

CHUNK_SIZE = 4096

rows = S3Blob.query.filter(S3Blob.size.is_(None)).all()

for idx, blob in enumerate(rows):
    name = '%s/%s' % (blob.owner, blob.hash)
    print("Processing %s (%d/%d)..." % (name, idx + 1, len(rows)))
    try:
        resp = s3_client.get_object(
            Bucket=PACKAGE_BUCKET_NAME,
            Key='%s/%s/%s' % (OBJ_DIR, blob.owner, blob.hash)
        )
    except ClientError as ex:
        print("Failed to get %s: %s" % (name, ex))
        continue

    body = resp['Body']
    size = 0

    try:
        with gzip.GzipFile(fileobj=body, mode='rb') as fd:
            for chunk in iter(lambda: fd.read(CHUNK_SIZE), b''):
                size += len(chunk)
    except OSError as ex:
        print("Failed to ungzip %s: %s" % (name, ex))
        continue

    blob.size = size

    db.session.add(blob)
    db.session.commit()

print("Done")
