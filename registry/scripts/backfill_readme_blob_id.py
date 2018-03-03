#!/usr/bin/env python3

"""
Backfills the instance.readme_blob_id column.
"""

import sys

from quilt_server import db

def main(argv):
    db.engine.execute('''
        UPDATE instance SET readme_blob_id = s3_blob.id
        FROM package, s3_blob
        WHERE instance.readme_blob_id IS NULL AND
              instance.package_id = package.id AND
              package.owner = s3_blob.owner AND
              instance.contents->'children'->'README'->'hashes'->>0 = s3_blob.hash
    ''')

    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
