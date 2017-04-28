"""
Add --integration option to pytest
"""
import pytest

def pytest_addoption(parser):
    parser.addoption("--integration", action="store_true", help="include integration tests")
