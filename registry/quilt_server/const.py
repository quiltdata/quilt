# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Constants
"""

from enum import Enum
import re

PUBLIC = 'public' # This username is blocked by Quilt signup
TEAM = 'team'

VALID_NAME_RE = re.compile(r'^[a-zA-Z]\w*$')
VALID_EMAIL_RE = re.compile(r'^([^\s@]+)@([^\s@]+)$')

class PaymentPlan(Enum):
    FREE = 'free'
    INDIVIDUAL = 'individual_monthly_7'
    TEAM = 'team_monthly_490'
    TEAM_UNPAID = 'team_unpaid'

FTS_LANGUAGE = 'english'
