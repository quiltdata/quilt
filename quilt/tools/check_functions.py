import re
import pandas as pd
from pandas import DataFrame as df
import numpy

# defined as lowecase globals so importing the library results in clean syntax
# like this:  qc.data[colname], qc.env, qc.filename, etc.
filename = None                 # pylint:disable=C0103
data = None                     # pylint:disable=C0103
env = 'default'                 # pylint:disable=C0103
seed = 0  # for reproducibility             # pylint:disable=C0103

ALL_COL_RX = '.+'

class CheckFunctionsReturn(Exception):
    def __init__(self, result):
        super(CheckFunctionsReturn, self).__init__()
        self.result = result

class CheckFunctionsException(Exception):
    def __init__(self, result):
        super(CheckFunctionsException, self).__init__()
        print(result)
        self.result = result

def check(expr, envs=None, chk_not=True):
    global env                  # pylint:disable=C0103
    if envs is not None:
        # TODO: error if env not found
        expr = envs.get(env, expr)
    if (chk_not and not expr) or (not chk_not and expr):
        raise CheckFunctionsReturn(expr)

def print_recnums(msg, expr, maxrecs=30):
    matching_recs = [str(i) for i, val in enumerate(expr) if val]
    print('{}: {}{}'.format(msg, ",".join(matching_recs[0:maxrecs]),
                            "" if len(matching_recs) < maxrecs else ",..."))

def data_sample(*args, **kwargs):
    global data, seed           # pylint:disable=C0103
    if 'seed' in args:
        seed = kwargs['seed']
    if 'random_state' not in args:
        kwargs['random_state'] = numpy.random.random_sample # pylint:disable=E1101
    data = data.sample(*args, **kwargs)

def check_column_enum(colrx, lambda_or_listexpr, envs=None, chk_not=True):
    if envs not in [None, 'default']:
        check_column_regexp(colrx, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            if callable(lambda_or_listexpr):
                check(lambda_or_listexpr(data[colname]), chk_not=chk_not)
            else:
                check(data[colname].isin(lambda_or_listexpr).all(), chk_not=chk_not)
def check_not_column_enum(colrx, lambda_or_listexpr, envs=None):
    return check_column_enum(colrx, lambda_or_listexpr, envs, chk_not=False)
def check_row_enum(lambda_or_listexpr, envs=None, chk_not=True):
    return check_column_enum(ALL_COL_RX, lambda_or_listexpr, envs, chk_not)
def check_not_row_enum(lambda_or_listexpr, envs=None):
    return check_column_enum(ALL_COL_RX, lambda_or_listexpr, envs, chk_not=False)

                
VALRANGE_FUNCS = {
    'mean':     lambda col: col.mean(),
    'mode':     lambda col: col.mode(),
    'stddev':   lambda col: col.std(),
    'variance': lambda col: col.var(),
    'median':   lambda col: col.median(),
    'sum':      lambda col: col.sum(),
    'count':    lambda col: col.count(),
}
VALRANGE_FUNCS['avg'] = VALRANGE_FUNCS['mean']
VALRANGE_FUNCS['std'] = VALRANGE_FUNCS['stdev'] = VALRANGE_FUNCS['stddev']
VALRANGE_FUNCS['var'] = VALRANGE_FUNCS['variance']
                
def check_column_valrange(colrx, minval=None, maxval=None, lambda_or_name=None, envs=None, chk_not=True):
    if envs not in [None, 'default']:
        check_column_valrange(colrx, minval, maxval, lambda_or_name, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            col = data[colname]
            if minval is None and maxval is None:
                raise CheckFunctionsException(
                    'check_column_valrange() requires minval or maxval')
            minval = col.min() if minval is None else minval
            maxval = col.max() if maxval is None else maxval
            if lambda_or_name is None:
                res = (minval <= col).all() and (col <= maxval).all()
            elif lambda_or_name in VALRANGE_FUNCS:
                colvals = VALRANGE_FUNCS[lambda_or_name](col)
                res = (minval <= colvals).all() and (colvals <= maxval).all()
            elif callable(lambda_or_name):
                colvals = lambda_or_name(col)
                res = (minval <= colvals).all() and (colvals <= maxval).all()
            else:
                raise CheckFunctionsException(
                    'check_column_valrange(): unknown func: %s' % (lambda_or_name))
            if not res and not chk_not:
                raise CheckFunctionsReturn(
                    "check_column_valrange column {} out of range {} - {}".format(
                        colname, minval, maxval))
            elif res and chk_not:
                raise CheckFunctionsReturn(
                    "check_column_valrange column {} unexpectedly in range {} - {}".format(
                        colname, minval, maxval))
def check_not_column_valrange(colrx, minval=None, maxval=None, lambda_or_name=None, envs=None):
    return check_column_valrange(colrx, minval, maxval, lambda_or_name, envs, chk_not=False)
def check_row_valrange(minval=None, maxval=None, lambda_or_name=None, envs=None, chk_not=True):
    return check_column_valrange(ALL_COL_RX, minval, maxval, lambda_or_name, envs, chk_not)
def check_not_row_valrange(minval=None, maxval=None, lambda_or_name=None, envs=None):
    return check_column_valrange(ALL_COL_RX, minval, maxval, lambda_or_name, envs, chk_not=False)


def check_column_regexp(colrx, regexp, envs=None, chk_not=True):
    if envs not in [None, 'default']:
        check_column_regexp(colrx, regexp, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            check(data[colname].astype(str).str.match(regexp).all(), chk_not=chk_not)
def check_not_column_regexp(colrx, regexp, envs=None):
    return check_column_regexp(colrx, regexp, envs, chk_not=False)
def check_row_regexp(regexp, envs=None, chk_not=True):
    return check_column_regexp(ALL_COL_RX, regexp, envs, chk_not)
def check_not_row_regexp(regexp, envs=None):
    return check_column_regexp(ALL_COL_RX, regexp, envs, chk_not=False)

def check_column_substr(colrx, substr, envs=None, chk_not=True):
    if envs not in [None, 'default']:
        check_column_substr(colrx, substr, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            check( (data[colname].astype(str).str.contains(substr)).all(), chk_not=chk_not )
def check_not_column_row_substr(colrx, substr, envs=None):
    return check_column_substr(ALL_COL_RX, substr, envs, chk_not=False)
def check_row_substr(substr, envs=None, chk_not=True):
    return check_column_substr(ALL_COL_RX, substr, envs, chk_not)
def check_not_row_substr(substr, envs=None):
    return check_column_substr(ALL_COL_RX, substr, envs, chk_not=False)


def check_column_datetime(colrx, fmt, envs=None, chk_not=True):
    if envs not in [None, 'default']:
        check_column_datetime(colrx, fmt, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            try:
                pd.to_datetime(data[colname], format=fmt, errors='raise')
            except Exception as ex:
                raise CheckFunctionsReturn(str(ex))
def check_not_column_datetime(colrx, fmt, envs=None):
    return check_column_datetime(colrx, fmt, envs, chk_not=False)
def check_row_datetime(fmt, envs=None, chk_not=True):
    return check_column_datetime(ALL_COL_RX, fmt, envs, chk_not)
def check_not_row_datetime(fmt, envs=None):
    return check_column_datetime(ALL_COL_RX, fmt, envs, chk_not=False)
            
