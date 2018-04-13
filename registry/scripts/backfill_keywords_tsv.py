#!/usr/bin/env python3

"""
Backfills s3_blob.preview by downloading the contents from S3.
"""

import sys

import sqlalchemy as sa
from sqlalchemy.orm import undefer

from quilt_server import db
from quilt_server.const import FTS_LANGUAGE
from quilt_server.models import Instance, Package
from quilt_server.search import keywords_tsvector

def main(argv):
    rows = (
        db.session.query(Instance, Package.owner, Package.name)
        .join(Instance.package)
        .options(undefer('contents'))
        .filter(sa.or_(
            Instance.keywords_tsv.is_(None),
            sa.not_(Instance.keywords_tsv.op('@@')(
                sa.func.plainto_tsquery(FTS_LANGUAGE, Package.owner + '/' + Package.name)
            ))
        ))
    )

    for idx, (instance, owner, name) in enumerate(rows):
        print("%s/%s:%s" % (owner, name, instance.hash))
        instance.keywords_tsv = keywords_tsvector(owner, name, instance.contents)
        if (idx + 1) % 100 == 0:
            db.session.commit()

    db.session.commit()
    print("Done!")

    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
