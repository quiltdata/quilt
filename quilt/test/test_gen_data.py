"""
test gen_data functions
"""
import re

from . import gen_data

NROWS = 58825
ARGS = {
    'nstr': 3,
    'ndate': 2,
    'ndtime': 1,
    'nint': 2,
    'ndouble': 14,
    'nuid': 1
}

def test_df():
    """
    verify if gen_data.df() is generating correct number of rows
    and columns of the expected type
    """
    mydf = gen_data.df(nrows=NROWS, **ARGS)
    nrows = len(mydf)
    assert nrows == NROWS, 'unexpected number of rows %s' % nrows

    cols = mydf.columns
    # verify we have the right number of columns of each type
    for arg in ARGS:
        # chop off leading n
        rx = re.compile(arg[1:], re.I)
        count = 0
        for c in cols:
            if rx.match(c):
                count += 1
        assert count == ARGS[arg], 'unexpected # of %s columns' % arg
