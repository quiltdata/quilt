""" Testing for util.py """

import pathlib
from unittest import mock

import pytest

from quilt3 import util

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
    'env_val, expected_val',
    (
        (None, None),
        ('', None),
        ('1', 1),
        ('10', 10),
        ('20', 20),
    )
)
def test_get_pos_int_from_env(env_val, expected_val):
    var_name = 'ENV_VAR_NAME'
    with mock.patch.dict('os.environ', {} if env_val is None else {var_name: env_val}, clear=True):
        assert util.get_pos_int_from_env(var_name) == expected_val


@pytest.mark.parametrize('env_val', ('blah', '-3', '0'))
def test_get_pos_int_from_env_error(env_val):
    var_name = 'ENV_VAR_NAME'
    with mock.patch.dict('os.environ', {} if env_val is None else {var_name: env_val}, clear=True):
        with pytest.raises(ValueError) as e:
            util.get_pos_int_from_env(var_name)
        assert f'{var_name} must be a positive integer' == str(e.value)
