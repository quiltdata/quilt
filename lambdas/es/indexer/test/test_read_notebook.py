"""
Test functions for text extraction from Jupyter notebooks
"""
import os

import pytest
from nbformat.reader import NotJSONError

from ..index import extract_text
from .constants import NORMAL_EXTRACT

NB_RAISES = {
    '404.ipynb': NotJSONError,
    'attribute-error.ipynb': AttributeError,
    'empty.ipynb': NotJSONError,
    'malformed-json.ipynb': NotJSONError,
}

NB_EXTRACTS = {
    'raw.ipynb': '',
    'normal.ipynb': NORMAL_EXTRACT,
}

def test_extract_text():
    """ test extraction of code + markdown with format_notebook
    this code was developed after running format_notebook on ~6400 notebooks
    found here s3://alpha-quilt-storage/tree/notebook-search/
    """
    parent = os.path.dirname(__file__)
    basedir = os.path.join(parent, 'data')
    for name in NB_RAISES:
        path = os.path.join(basedir, name)
        with open(path) as notebook:
            contents = notebook.read()
            with pytest.raises(NB_RAISES[name]):
                extract_text(contents)

    for name in NB_EXTRACTS:
        path = os.path.join(basedir, name)
        with open(path) as notebook:
            contents = notebook.read()
            extracted = extract_text(contents)
            assert extracted == NB_EXTRACTS[name]
