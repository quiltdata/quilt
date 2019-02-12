# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Constants
"""

from enum import Enum
import re

PUBLIC = 'public' # This username is blocked by Quilt signup
TEAM = 'team'

VALID_EMAIL_RE = re.compile(r'^([^\s@]+)@([^\s@]+)$')
VALID_NAME_RE = re.compile(r'^[a-zA-Z]\w*$')
VALID_USERNAME_RE = re.compile(r'^[a-z][a-z0-9_]*$')

class PaymentPlan(Enum):
    FREE = 'free'
    INDIVIDUAL = 'individual_monthly_7'
    TEAM = 'team_monthly_490'
    TEAM_UNPAID = 'team_unpaid'

FTS_LANGUAGE = 'english'

INVALID_USERNAMES = frozenset([
    TEAM,
    PUBLIC,
    'anonymous',
    'quilt'
])

ACTIVATE_SALT = 'activate'
CODE_TTL_DEFAULT = {'minutes': 10}
MAX_LINK_AGE = 60 * 60 * 24 # 24 hours
PASSWORD_RESET_SALT = 'reset'
TOKEN_TTL_DEFAULT = {'days': 90}

AWS_TOKEN_DURATION = 60 * 60 # 1 hour
