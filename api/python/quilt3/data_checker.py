import functools
import click
import os
import sys
import unittest

from .packages import Package

class TestLoader(unittest.TestLoader):
    testMethodPrefix = 'quilt_data_check'

    def __init__(self, quilt_package, quilt_package_name):
        super().__init__()
        self.quilt_package = quilt_package
        self.quilt_package_name = quilt_package_name

    @classmethod
    def visit(cls, suite, func):
        for test in suite:
            if isinstance(test, unittest.loader._FailedTest):
                # Allow failures in tests to pass through for error reporting.
                pass
            elif isinstance(test, unittest.TestCase):
                func(test)
            else:
                cls.visit(test, func)

    def discover(self, *args, **kwargs):
        suite = unittest.TestSuite()
        tests = super().discover(os.getcwd(),
                                 pattern='quilt_data_check*.py')
        suite.addTests(tests)
        TestLoader.visit(suite, lambda t: t.set_quilt_package(
            self.quilt_package, self.quilt_package_name))
        return suite

class TestCase(unittest.TestCase):
    def set_quilt_package(self, quilt_package, quilt_package_name):
        self.quilt_package = quilt_package
        self.quilt_package_name = quilt_package_name

    def set_quilt_package_name(self, quilt_package_name):
        self.quilt_package_name = quilt_package_name

    @classmethod
    def test_key(cls, source_name, sampling_rate=1):
        def decorator(func):
            @functools.wraps(func)
            def run_test(self, *args, **kwargs):
                logical_key = self.quilt_package[source_name]
                # TODO: Add support for regex filtering here
                with self.subTest(quilt_package=self.quilt_package_name):
                    return func(self, logical_key, *args, **kwargs)
            return run_test
        return decorator

    @classmethod
    def test_package(cls):
        def decorator(func):
            @functools.wraps(func)
            def run_test(self, *args, **kwargs):
                # TODO: Add support for prefix/subpackage filtering here
                with self.subTest():
                    return func(self, *args, **kwargs)
            return run_test
        return decorator

def check_packages(pkg_names, registry=None):
    runner = unittest.TextTestRunner()
    passing = 1
    for pkg_name in pkg_names:
        print(f'Testing {pkg_name}')
        loader = TestLoader(Package.browse(pkg_name, registry=registry), pkg_name)
        result = runner.run(loader.discover())
        if not result.wasSuccessful():
            passing = 0
    return passing
