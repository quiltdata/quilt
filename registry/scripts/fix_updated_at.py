#!/usr/bin/env python3

"""
Rebuilds the full-text search index (to fix the language).
"""

import sys

from quilt_server import db

def main(argv):
    result = db.engine.execute('''
        UPDATE instance SET updated_at = t.updated_at
        FROM (SELECT instance_id, max(created) AS updated_at FROM log GROUP BY instance_id) t
        WHERE instance.id = t.instance_id AND instance.updated_at != t.updated_at
    ''')

    print("Updated %d rows." % result.rowcount)

    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
