# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Full-text search helper functions.
"""

from functools import reduce
import os
import re

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TSVECTOR

from .const import FTS_LANGUAGE
from .core import GroupNode

def tsvector_concat(*args):
    return reduce(sa.sql.operators.custom_op('||'), args)

def find_node_keywords(obj):
    if isinstance(obj, GroupNode):
        for name, child in obj.children.items():
            yield name
            yield from find_node_keywords(child)

TOKEN_RE = re.compile(r'[a-z]+|\d+', re.I)

with open(os.path.join(os.path.dirname(__file__), 'resources', 'words.txt')) as fd:
    DICTIONARY = frozenset(w.strip().lower() for w in fd)

def tokenize(string):
    min_length = 3
    for match in TOKEN_RE.finditer(string):
        value = match.group()
        yield value
        length = len(value)
        for start in range(0, length - min_length + 1):
            for end in range(start + min_length, length + 1):
                substr = value[start:end]
                if substr != value and substr in DICTIONARY:
                    yield substr

def keywords_tsvector(owner, name, contents):
    full_name = '%s/%s' % (owner, name)

    def _to_tsvector(keywords):
        return sa.func.to_tsvector(FTS_LANGUAGE, ' '.join(keywords))

    # "tokenize" may return keywords that will become duplicates, such as "dog" and "dogs",
    # giving them more weight during search ranking. Clean them up, and reset their position to 1.
    # "dogscats dog dogs cat cats" -> "dogscat:1 dog:1 cat:1"
    # TODO(dima): Upgrade to Postgres 10 to make this less painful.
    def _keywords_tsvector(keywords):
        return sa.select([
            sa.func.coalesce(
                sa.func.array_to_string(
                    sa.func.array_agg(sa.column('lexeme') + ':1'), ' '
                ), ''
            )
            .cast(TSVECTOR)
        ]).select_from(
            sa.func.unnest(_to_tsvector(keywords))
        )

    return tsvector_concat(
        sa.func.setweight(_to_tsvector([full_name, owner, name]), 'A'),
        sa.func.setweight(_keywords_tsvector(tokenize(owner)), 'B'),
        sa.func.setweight(_keywords_tsvector(tokenize(name)), 'B'),
        sa.func.setweight(_to_tsvector(find_node_keywords(contents)), 'C')
    )
