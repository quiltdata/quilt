from setuptools import setup

setup(
    name='put_mappings',
    version='0.0.1',
    py_modules=['put_mappings', 'cfnresponse'],
    install_requires=[
        'elasticsearch==6.3.1',
        'aws-requests-auth==0.4.2',
    ],
)
