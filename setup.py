# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

from setuptools import setup

setup(
    name='quilt_server',
    packages=['quilt_server'],
    include_package_data=True,
    python_requires='>=3.4, <4',
    install_requires=[
        'boto3',
        'Flask',
        'Flask-Cors',
        'Flask-JSON',
        'Flask-Migrate',
        'httpagentparser>=1.8.0',
        'jsonschema',
        'mixpanel',
        'packaging',
        'responses',
        'PyMySQL',
        'requests-oauthlib',
        'sqlalchemy_utils',
        'stripe',
    ],
)
