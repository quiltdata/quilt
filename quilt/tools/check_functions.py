import re
from pandas import DataFrame as df
import numpy
import pytest

filename = None
data = None
env = 'default'
seed = 0  # for reproducibility
distrib_hash_vals = None

class CheckFunctionsReturn(Exception):
    def __init__(self, result):
        self.result = result

class CheckFunctionsException(Exception):
    def __init__(self, result):
        self.result = result

def check(expr, envs=None):
    global env
    if envs is not None:
        override = envs.get(env)
        if override:
            expr = override
        # TODO: error if env is missing?
    raise CheckFunctionsReturn(expr)

def print_recnums(msg, expr, maxrecs=30):
    matching_recs = [str(i) for i,val in enumerate(expr) if val]
    print('{}: {}{}'.format(msg, ",".join(matching_recs[0:maxrecs]),
                            "" if len(matching_recs)<maxrecs else ",..."))

def data_sample(*args, **kwargs):
    global data, seed
    if 'seed' in args:
        seed = args['seed']
    if 'random_state' not in args:
        kwargs['random_state'] = numpy.random.RandomState(seed)
    data = data.sample(*args, **kwargs)

def check_column_enum(colrx, lambda_or_listexpr, envs=None):
    if envs not in [None, 'default']: check_column_regexp(colrx, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            if callable(lambda_or_listexpr):
                check(lambda_or_listexpr(data[colname]))
            else:
                check(df.all(data[colname].isin(lambda_or_listexpr)))

def check_column_valrange(colrx, minval=None, maxval=None, lambda_or_name=None, envs=None):
    if envs not in [None, 'default']: check_column_regexp(colrx, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            if minval is None and maxval is None:
                raise CheckFunctionsException(
                    'check_column_valrange() requires minval or maxval')
            col = data[colname]
            if callable(lambda_or_name):
                col = lambda_or_name(col)
            if minval is None:
                minval = col.min()
            if maxval is None:
                maxval = col.max()
            if lambda_or_name in ["mean", "avg"]:
                return check(minval <= col.mean() <= maxval)
            elif lambda_or_name == "mode":
                return check(minval <= col.mode() <= maxval)
            elif lambda_or_name in ["std", "stddev"]:
                return check(minval <= col.std() <= maxval)
            elif lambda_or_name in ["var", "variance"]:
                return check(minval <= col.var() <= maxval)
            elif lambda_or_name == "median":
                return check(minval <= col.median() <= maxval)
            elif lambda_or_name == "sum":
                return check(minval <= col.sum() <= maxval)
            elif lambda_or_name == "count":
                return check(minval <= col.count() <= maxval)
            elif lambda_or_name == "abs":
                return check(df.all(col.between(minval, maxval, inclusive=True)))
            raise CheckFunctionsException(
                'check_column_valrange(): unknown func: %s' % (lambda_or_name))

def check_column_regexp(colrx, regexp, envs=None):
    if envs not in [None, 'default']: check_column_regexp(colrx, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            check(df.all(data[colname].str.match(regexp)))

def check_column_substr(colrx, substr, envs=None):
    if envs not in [None, 'default']: check_column_regexp(colrx, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            check(df.all(data[colname].str.index(substr) != -1))

def check_column_datetime(colrx, format, envs=None):
    if envs not in [None, 'default']: check_column_regexp(colrx, envs[env])
    for colname in list(data):
        if re.search(colrx, colname):
            try:
                pd.to_datetime(data[colname], format=format, errors='raise')
            except Exception as ex:
                raise CheckFunctionsReturn(str(ex))
