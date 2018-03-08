#!/usr/bin/env python3

"""
Backfills s3_blob.preview by downloading the contents from S3.
"""

import sys

from botocore.exceptions import ClientError
import sqlalchemy as sa

from quilt_server import db
from quilt_server.models import Instance, Package, S3Blob
from quilt_server.views import download_object_preview_impl

def main(argv):
    rows = (
        S3Blob.query
        .select_from(Instance)
        .join(Instance.readme_blob)
        .filter(S3Blob.preview.is_(None))
    )

    for blob in rows:
        try:
            print("Downloading %s/%s..." % (blob.owner, blob.hash))
            preview = download_object_preview_impl(blob.owner, blob.hash)
            blob.preview = preview
            db.session.commit()
        except (ClientError, OSError) as ex:
            print("Failed: %s" % ex)

    print("Done!")

    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
