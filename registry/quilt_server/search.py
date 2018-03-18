# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Full-text search helper functions.
"""

from functools import reduce

import sqlalchemy as sa

from .const import FTS_LANGUAGE
from .core import FileNode, GroupNode, TableNode

def tsvector_concat(*args):
    return reduce(sa.sql.operators.custom_op('||'), args)

def find_node_keywords(obj):
    if isinstance(obj, GroupNode):
        for name, child in obj.children.items():
            yield name
            yield from find_node_keywords(child)

def keywords_tsvector(owner, name, contents):
    return tsvector_concat(
        sa.func.setweight(sa.func.to_tsvector(FTS_LANGUAGE, ' '.join([owner, name])), 'A'),
        sa.func.setweight(sa.func.to_tsvector(FTS_LANGUAGE, ' '.join(find_node_keywords(contents))), 'B')
    )
