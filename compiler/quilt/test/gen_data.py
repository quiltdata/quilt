"""
generate fake data for testing
"""
import math
import random
import time
import uuid

import numpy as np
import pandas as pd

from ..tools.const import DATEF, TIMEF, DTIMEF

MAXINT = 1000*1000*1000
MINSTR = 5
MAXSTR = 100 # max string length
NCATS = 100 # of types of strings
NROWS = 10000 # 1M
def df(nrows=NROWS,
       nuid=1,
       nstr=1,
       ndate=1,
       ndtime=1,
       nint=2,
       ndouble=7):
    """
    inspiration: https://gist.github.com/wesm/0cb5531b1c2e346a0007
    nuid=a # UUID columns
    strcols=1 # string columns
    datecols=1 # data columns
    dtimecols=0 # date-time columns
    intcols=2 # int columns
    doublecols=7 # double columns

    TODO: use generators over comprehensions for faster perf
    """
    assert nrows > 0, 'rows must be greater than 0'

    cols = []
    data = {}

    for i in range(nuid):
        name = 'UID%s' % nuid
        cols.append(name)
        data[name] = [str(uuid.uuid4()) for _ in range(nrows)]

    for i in range(nstr):
        cats = [
            pd.util.testing.rands(random.randrange(MINSTR, MAXSTR))
            for _ in range(NCATS)
        ]
        # make enough repeats
        ceil = math.ceil(nrows/NCATS)
        # slice to nrows many
        strs = [random.choice(cats) for _ in range(nrows)]
        name = 'Str%s' % i
        cols.append(name)
        data[name] = strs

    for i in range(ndate):
        #get a bunch of unix times
        utimes = [rand_time() for _ in range(nrows)]
        #convert to dates
        maked = lambda t: time.strftime(DATEF, time.gmtime(t))
        dates = [maked(t) for t in utimes]
        name = 'Date%s' % i
        cols.append(name)
        data[name] = dates

    for i in range(ndtime):
        #get a bunch of unix times
        utimes = [rand_time() for _ in range(nrows)]
        #convert to datetimes
        maked = lambda t: time.strftime(DTIMEF, time.gmtime(t))
        dtimes = [maked(t) for t in utimes]
        name = 'DTime%s' % i
        cols.append(name)
        data[name] = dtimes

    for i in range(nint):
        ints = [np.random.randint(-MAXINT, MAXINT) for _ in range(nrows)]
        name = 'Int%s' % i
        cols.append(name)
        data[name] = ints

    for i in range(ndouble):
        doubles = np.random.lognormal(sigma=100, size=nrows)
        name = 'Double%s' % i
        cols.append(name)
        data[name] = pd.Series(doubles)

    return pd.DataFrame(data, columns=cols)


def rand_time():
    """
    random unix time between 0 (epoch start in 1970)
    and today
    """
    maxt = math.floor(time.time())
    return np.random.randint(0, maxt)
