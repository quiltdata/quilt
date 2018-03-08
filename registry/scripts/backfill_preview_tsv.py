#!/usr/bin/env python3

"""
Rebuilds the full-text search index (to fix the language).
"""

import sys

from quilt_server import db
from quilt_server.const import FTS_LANGUAGE

def main(argv):
    result = db.engine.execute('''
        UPDATE s3_blob SET preview_tsv = to_tsvector(%s, preview)
        WHERE preview IS NOT NULL AND preview_tsv IS NULL
    ''', FTS_LANGUAGE)

    print("Updated %d rows." % result.rowcount)

    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
