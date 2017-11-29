"""
Integration testing helpers
"""
import pytest

skip = pytest.mark.skipif(
    not pytest.config.getoption("--integration"),
    reason="no --integration arg"
)
