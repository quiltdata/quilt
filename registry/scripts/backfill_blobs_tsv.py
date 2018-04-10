#!/usr/bin/env python3

"""
Backfills the instance.readme_blob_id column.
"""

import sys

from quilt_server import db
from quilt_server.const import FTS_LANGUAGE

def main(argv):
    result = db.engine.execute('''
        UPDATE instance SET blobs_tsv = to_tsvector(%s, s3_blob.preview)
        FROM s3_blob
        WHERE instance.readme_blob_id = s3_blob.id AND
              instance.blobs_tsv = ''
    ''', FTS_LANGUAGE)

    print("Updated %d rows." % result.rowcount)

    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
