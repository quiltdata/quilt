# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Constants
"""

from enum import Enum
import re

PUBLIC = 'public' # This username is blocked by Quilt signup
EMAILREGEX = re.compile(r'^([^\s@]+)@([^\s@]+)$')

class PaymentPlan(Enum):
    FREE = 'free'
    INDIVIDUAL = 'individual_monthly_7'
