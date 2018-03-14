#!/usr/bin/env python3

"""
Backfills s3_blob.preview by downloading the contents from S3.
"""

import sys

import sqlalchemy as sa
from sqlalchemy.orm import undefer

from quilt_server import db
from quilt_server.models import Instance, Package, S3Blob
from quilt_server.search import keywords_tsvector

def main(argv):
    rows = (
        db.session.query(Instance, Package.owner, Package.name)
        .join(Instance.package)
        .options(undefer('contents'))
        .filter(Instance.keywords_tsv.is_(None))
    )

    for instance, owner, name in rows:
        instance.keywords_tsv = keywords_tsvector(owner, name, instance.hash, instance.contents)

    db.session.commit()
    print("Done!")

    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
