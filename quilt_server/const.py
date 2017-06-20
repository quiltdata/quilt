"""
Constants
"""

from enum import Enum

PUBLIC = 'public' # This username is blocked by Quilt signup

class PaymentPlan(Enum):
    BASIC = 'basic'
    PRO = 'pro'
