# Copyright (c) 2017 Quilt Data, Inc.

"""
Constants
"""

from enum import Enum

PUBLIC = 'public' # This username is blocked by Quilt signup

class PaymentPlan(Enum):
    FREE = 'free'
    INDIVIDUAL = 'individual_monthly_7'
