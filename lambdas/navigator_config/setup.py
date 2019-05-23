from setuptools import setup

setup(
    name='lambda_function',
    version='0.0.1',
    py_modules=['index', 'cfnresponse'],
    data_files=[('', ['config-schema.json', 'federation-schema.json'])]
)
