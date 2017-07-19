# Copyright (c) 2017 Quilt Data, Inc.

from setuptools import setup

setup(
    name='quilt_server',
    packages=['quilt_server'],
    include_package_data=True,
    install_requires=[
        'boto3',
        'Flask',
        'Flask-Cors',
        'Flask-JSON',
        'Flask-Migrate',
        'httpagentparser',
        'jsonschema',
        'mixpanel',
        'packaging',
        'PyMySQL',
        'requests-oauthlib',
        'stripe',
    ],
)
