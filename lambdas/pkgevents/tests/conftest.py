import os


def pytest_configure(config):
    os.environ['AWS_ACCESS_KEY_ID'] = 'foo'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'bar'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
