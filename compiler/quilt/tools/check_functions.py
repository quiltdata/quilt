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

class CheckFunctionsReturn(Exception):
    def __init__(self, result):
        super(CheckFunctionsReturn, self).__init__()
        self.result = result

class CheckFunctionsException(Exception):
    def __init__(self, result):
        super(CheckFunctionsException, self).__init__()
        self.result = result

def check(expr, envs=None):
    global env                  # pylint:disable=C0103
    if envs is not None:
        # TODO: error if env not found
        expr = envs.get(env, expr)
    if not expr:
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

def check_column_enum(colrx, lambda_or_listexpr, envs=None):
    if envs not in [None, 'default']:
        check_column_regexp(colrx, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            if callable(lambda_or_listexpr):
                check(lambda_or_listexpr(data[colname]))
            else:
                check(data[colname].isin(lambda_or_listexpr).all())

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
                
def check_column_valrange(colrx, minval=None, maxval=None, lambda_or_name=None, envs=None):
    if envs not in [None, 'default']:
        check_column_valrange(colrx, minval, maxval, lambda_or_name, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            col = data[colname]
            if callable(lambda_or_name):
                col = lambda_or_name(col)
            if minval is None and maxval is None:
                raise CheckFunctionsException(
                    'check_column_valrange() requires minval or maxval')
            minval = col.min() if minval is None else minval
            maxval = col.max() if maxval is None else maxval
            if lambda_or_name in VALRANGE_FUNCS:
                if not check(minval <= VALRANGE_FUNCS[lambda_or_name](col) <= maxval):
                    raise CheckFunctionsReturn(
                        "check_column_valrange column {} out of range {} - {}".format(
                            colname, minval, maxval))
            raise CheckFunctionsException(
                'check_column_valrange(): unknown func: %s' % (lambda_or_name))

def check_column_regexp(colrx, regexp, envs=None):
    if envs not in [None, 'default']:
        check_column_regexp(colrx, regexp, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            check(data[colname].astype(str).str.match(regexp).all())

def check_column_substr(colrx, substr, envs=None):
    if envs not in [None, 'default']:
        check_column_substr(colrx, substr, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            check( (data[colname].str.index(substr) != -1).all() )

def check_column_datetime(colrx, fmt, envs=None):
    if envs not in [None, 'default']:
        check_column_datetime(colrx, fmt, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            try:
                pd.to_datetime(data[colname], format=fmt, errors='raise')
            except Exception as ex:
                raise CheckFunctionsReturn(str(ex))
