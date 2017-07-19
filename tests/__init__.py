# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Quilt server unittests
"""

import os

# Make sure boto doesn't try to use the real credentials.
os.environ['AWS_ACCESS_KEY_ID'] = 'fake_id'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'fake_secret'
