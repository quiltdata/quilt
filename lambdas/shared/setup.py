from setuptools import setup

setup(
    name='t4-lambda-shared',
    version='0.0.3',
    packages=['t4_lambda_shared'],
    install_requires=[
        'jsonschema>=2.6.0',
    ],
    extras_require={
        'tests': [
            'codecov',
            'pytest',
            'pytest-cov',
        ],
    },
)
