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
        super(QuiltTestCase, self).setUp()
        self.checks_data = read_yml_file('checks_simple.yml')
        self.checks_contents = self.checks_data['contents']
        self.build_data = read_yml_file('build_simple_checks.yml')
        self.build_contents = self.build_data['contents']

    def tearDown(self):
        super(QuiltTestCase, self).tearDown()

    def build_success(self, check, nodename='foo'):
        self.build_contents[nodename]['checks'] = check
        if check == 'string':
            raise Exception(str(self.build_data)+"\n\n"+str(self.checks_contents))
        mydir = os.path.dirname(__file__)
        build.build_package_from_contents(
            'foox', 'barx', mydir, self.build_data, self.checks_contents, dry_run=True)

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
        self.build_success('inline_only')
        self.build_success('inline_and_external')
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

