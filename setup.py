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
        'jsonschema',
        'mixpanel',
        'packaging',
        'PyMySQL',
        'requests-oauthlib',
    ],
)
