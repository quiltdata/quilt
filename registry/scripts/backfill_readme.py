#!/usr/bin/env python

"""
Changes the object layout in S3 from user/package/hash to user/hash.
Only copies the objects; does not delete the old ones. Safe to run multiple times.
"""

import sys

from quilt_server import db
from quilt_server.models import Instance, Package, S3Blob
from quilt_server.views import download_object_preview

def main(argv):
    rows = (
        S3Blob.query
        .filter(S3Blob.preview.is_(None))
        .join(S3Blob.instances)
        .filter(Instance.readme_hash() == S3Blob.hash)
    )

    for blob in rows:
        print("Downloading %s/%s..." % (blob.owner, blob.hash))
        preview = download_object_preview(blob.owner, blob.hash)
        blob.preview = preview
        db.session.commit()

    print("Done!")

    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
