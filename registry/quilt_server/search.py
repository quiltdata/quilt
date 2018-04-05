# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Full-text search helper functions.
"""

from functools import reduce
import re

import sqlalchemy as sa
import wordsegment

from .const import FTS_LANGUAGE
from .core import GroupNode

try:
    import uwsgi  # pylint:disable=W0611

    # If we're running in uwsgi, load word segment data at import time, before uwsgi forks.
    # That way, the 100MB of data is shared between worker processes (copy-on-write, etc.)

    # In theory, this shouldn't actually work because ref-counting would modify the data.
    # In practice, it appears to work?

    wordsegment.load()
except ImportError:
    pass

def tsvector_concat(*args):
    return reduce(sa.sql.operators.custom_op('||'), args)

def find_node_keywords(obj):
    if isinstance(obj, GroupNode):
        for name, child in obj.children.items():
            yield name
            yield from find_node_keywords(child)

ALPHA_NUM_RE = re.compile(r'[a-z]+|\d+', re.I)

def tokenize(string):
    """
    Split the input several times, returning intermediate results at each level:
    - delimited by underscores
    - letter/number boundaries
    - word segments
    E.g., tokenize('landuse_austin_tx_24dates') ->
        ['landuse', 'land', 'use', 'austin', 'tx', '24dates', '24', 'dates']

    (Don't need a token for the original string because to_tsvector splits on underscores.)
    """
    if not wordsegment.BIGRAMS:
        # Should only happen in dev.
        wordsegment.load()

    lvl1_parts = string.split('_')
    for lvl1 in lvl1_parts:
        lvl2_parts = ALPHA_NUM_RE.findall(lvl1)
        if len(lvl2_parts) > 1:
            yield lvl1
        for lvl2 in lvl2_parts:
            lvl3_parts = wordsegment.segment(lvl2)
            if len(lvl3_parts) > 1:
                yield lvl2
            yield from lvl3_parts

def keywords_tsvector(owner, name, contents):
    full_name = '%s/%s' % (owner, name)

    def _to_tsvector(keywords):
        return sa.func.to_tsvector(FTS_LANGUAGE, ' '.join(keywords))

    return tsvector_concat(
        sa.func.setweight(_to_tsvector([full_name, owner, name]), 'A'),
        sa.func.setweight(_to_tsvector(tokenize(owner)), 'B'),
        sa.func.setweight(_to_tsvector(tokenize(name)), 'B'),
        sa.func.setweight(_to_tsvector(find_node_keywords(contents)), 'C')
    )
