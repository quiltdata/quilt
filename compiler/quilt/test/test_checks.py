"""
Test the data checking / linting system
"""
import os
import re

from six import assertRaisesRegex
import yaml
import pytest

from ..tools.package import Package
from ..tools import build, command
from .utils import QuiltTestCase

def read_yml_file(fn):
    mydir = os.path.dirname(__file__)
    filepath = os.path.join(mydir, fn)
    with open(filepath) as fd:
        return next(yaml.load_all(fd), None)

class ChecksTest(QuiltTestCase):

    def setUp(self):
        super(ChecksTest, self).setUp()
        self.checks_data = read_yml_file('checks_simple.yml')
        self.checks_contents = self.checks_data['contents']
        self.build_data = read_yml_file('build_simple_checks.yml')
        self.build_contents = self.build_data['contents']

    def build_success(self, check, nodename='foo'):
        if check is not None:
            self.build_contents[nodename]['checks'] = check
        if check == 'string':
            raise Exception(str(self.build_data)+"\n\n"+str(self.checks_contents))
        mydir = os.path.dirname(__file__)
        build.build_package_from_contents(
            None, 'foox', 'barx', [], mydir, self.build_data, self.checks_contents, dry_run=True)

    def build_fail(self, check, regexp=None, nodename='foo'):
        # explicitly fail if build_success() somehow succeeds when it shouldn't
        try:
            self.build_success(check, nodename=nodename)
            pytest.fail('build_fail() called but test succeeded.')
        except pytest.fail.Exception:
            raise
        except Exception:
            pass
        if regexp is None:
            regexp = "Data check failed: %s" % (check)
        with assertRaisesRegex(self, build.BuildException, regexp):
            self.build_success(check, nodename=nodename)
        
    def test_parse_checks_file(self):
        assert str(self.checks_contents['negative']) == 'False'
        assert self.checks_contents['simple_multiline'] == '# comment\nqc.check(True)\n'
        assert self.build_contents['foo']['checks'] == 'simple, inline_only, inline_and_external'

    def test_bad_checks_reference(self):
        self.build_fail('doesnt_exist', "Unknown check.+doesnt_exist")

    def test_external_only(self):
        del self.build_data['checks']
        self.build_fail('inline_only', "Unknown check.+inline_only")
        
    def test_inline_only(self):
        self.checks_contents = self.checks_data = None
        self.build_success('inline_only')
        self.build_fail('hasrecs', "Unknown check.+hasrecs")
        
    def test_simple_checks(self):
        self.build_success('simple')
        self.build_success('simple_multiline')
        self.build_fail('negative')
        self.build_success('hasrecs')
        self.build_success('hascols')
        self.build_success('cardinality')
        self.build_fail('has9999cols')
        self.build_success('multiline_success')
        self.build_fail('multiline_fail')
        self.build_success('enum_list_success')
        self.build_fail('enum_list_fail')
        self.build_fail('enum_list_fail_empty')
        self.build_success('enum_lambda_success')
        self.build_success('stddev')
        self.build_success('sum')

    def test_inline_vs_external(self):
        self.build_success('inline_only')
        self.build_success('inline_and_external')
        self.build_success('hasrecs')
        
    def test_many_errors(self):
        # TODO: capture details by line number
        self.build_contents['foo'] = { 'checks': 'lots_uid_errors',
                                       'file': 'data/10KRows13Cols.csv' }
        self.checks_contents['lots_uid_errors'] = (
            "qc.check_column_regexp('UID1', r'^[0-9a-e]')")
        self.build_fail('lots_uid_errors')

    def test_string_checks(self):
        self.build_contents['foo'] = { 'checks': 'stringchecks',
                                       'file': 'data/10KRows13Cols.tsv' }
        self.checks_contents['stringchecks'] = """
qc.check_column_substr('UID.+', '-')  # must contain a dash
qc.check_column_regexp('UID.+', r'^[0-9a-f-]+$')
qc.check_column_datetime('Date0', '%Y-%m-%d')
qc.check_column_datetime('DTime0', '%Y-%m-%d %H:%M:%S.%f')
        """
        self.build_success('stringchecks')

    def test_empty_checks(self):
        self.build_contents = {}
        self.checks_contents = None
        self.build_success(None)

    def test_build_package(self):
        def run_build(build_fn=None, checks_fn=None, expect_error=False):
            build_fn = os.path.join(os.path.dirname(__file__), build_fn) if build_fn else None
            checks_fn = os.path.join(os.path.dirname(__file__), checks_fn) if checks_fn else None
            if expect_error:
                with assertRaisesRegex(self, IOError, 'doesnt_exist.yml'):
                    build.build_package(None, 'foox', 'barx', [], build_fn, checks_fn, dry_run=True)
            else:
                build.build_package(None, 'foox', 'barx', [], build_fn, checks_fn, dry_run=True)
        run_build("build_simple_checks.yml", "checks_simple.yml")
        run_build("doesnt_exist.yml", "checks_simple.yml", True)
        run_build("build_simple_checks.yml", "doesnt_exist.yml", True)
        run_build("build_simple_checks.yml", None)
        # bad yaml files
        with assertRaisesRegex(self, yaml.parser.ParserError, 'expected'):
            run_build("build_simple_checks.yml", "test_checks.py")
        with assertRaisesRegex(self, yaml.parser.ParserError, 'expected'):
            run_build("test_checks.py", None)

