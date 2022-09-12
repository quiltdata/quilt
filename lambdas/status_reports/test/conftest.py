import os


def pytest_configure(config):
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
