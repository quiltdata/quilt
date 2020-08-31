""" Testing for util.py """

import os
import pathlib
import shutil

import pytest

from quilt3 import util
from quilt3.util import QuiltException

# Constants
TEST_YAML = """
    # This is an arbitrary comment solely for the purposes of testing.
    c: the speed of light
    d: a programming language that almost mattered
    # Another arbitrary comment.
    e: a not-so-hip MC from a relatively unknown nightclub    # do you like cats?
    """


# Code
def test_write_yaml(tmpdir):
    fname = tmpdir / 'some_file.yml'

    util.write_yaml({'testing': 'foo'}, fname)
    assert fname.read_text('utf-8') == 'testing: foo\n'

    util.write_yaml({'testing': 'bar'}, fname, keep_backup=True)

    fnames = [name for name in tmpdir.listdir() if name.basename.startswith('some_file')]

    assert len(fnames) == 2

    fname2 = max(fnames, key=lambda x: len(x.basename))  # backup name is longer
    assert fname2.read_text('utf-8') == 'testing: foo\n'
    assert fname.read_text('utf-8') == 'testing: bar\n'


def test_read_yaml(tmpdir):
    # Read a string
    parsed_string = util.read_yaml(TEST_YAML)
    fname = tmpdir / 'test_read_yaml.yml'

    util.write_yaml(parsed_string, fname)

    # Read file descriptor..
    with fname.open('r') as f:
        parsed_file = util.read_yaml(f)
    assert parsed_file == parsed_string

    # Read Path object
    parsed_path_obj = util.read_yaml(pathlib.Path(fname))
    assert parsed_string == parsed_path_obj


def test_read_yaml_exec_flaw(capfd):
    # We don't execute anything remote, but someone could give a bad build.yml..
    with pytest.raises(util.QuiltException) as exc_info:
        util.read_yaml("""!!python/object/apply:os.system\nargs: ['echo arbitrary code execution!']""")
    assert "could not determine a constructor for the tag" in str(exc_info.value)


def test_validate_url():
    with pytest.raises(util.QuiltException, match='Port must be a number'):
        util.validate_url('http://foo:bar')

    with pytest.raises(util.QuiltException, match='Requires at least scheme and host'):
        util.validate_url('blah')


@pytest.mark.parametrize(
    'package, expected_package_name, expected_sub_path, expected_top_hash',
    [
        ('greg/test', 'greg/test', None, None),
        ('greg/test:latest', 'greg/test', None, None),
        ('greg/test:00934has2', 'greg/test', None, '00934has2'),
        ('greg/test/sub/package/dir', 'greg/test', 'sub/package/dir', None),
        ('greg/test/sub/package/dir:00934has2', 'greg/test', 'sub/package/dir', '00934has2'),
        pytest.param('invalid package', 'invalid', None, None, marks=pytest.mark.xfail(raises=QuiltException)),
    ]
)
def test_parse_packages(package, expected_package_name, expected_sub_path, expected_top_hash):
    parsed = util.parse_package(package)
    assert parsed.name == expected_package_name
    assert parsed.top_hash == expected_top_hash
    assert parsed.path == expected_sub_path


@pytest.mark.parametrize(
    'name, expected_quilt_version, no_of_packages',
    [
        ('@quilt.yml', '3.1.10', 3),
        ('quilt.yml', '3.1.10', 3),
        ('akarve/cord19', None, 1)
    ]
)
def test_quilt_install_package_parser(name, expected_quilt_version, no_of_packages):
    config_file = pathlib.Path(__file__).parent / 'data/quilt.yml'
    shutil.copy(config_file, 'quilt.yml')
    parser = util.QuiltInstallPackageParser(name)
    packages = parser.get_packages()

    assert parser.get_quilt_version() == expected_quilt_version
    assert len(packages) == 3

    # remove created file
    os.remove("quilt.yml")


def test_quilt_install_package_parse_failure():
    # Invalid file type
    with pytest.raises(QuiltException) as e:
        util.QuiltInstallPackageParser('quilt.ynnl')
    assert "'quilt.ynnl' is not a valid" in str(e.value)

    # Config file not in current path
    with pytest.raises(QuiltException) as e:
        util.QuiltInstallPackageParser('quilt.yml')
    assert "'quilt.yml' does not exist" in str(e.value)
