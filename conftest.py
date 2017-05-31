"""
Add --integration option to pytest
"""
import pytest

def pytest_addoption(parser):
    parser.addoption("--integration", action="store", help="run integration test against provided env URL")
