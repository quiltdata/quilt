
### stdlib and backports
try:
    import unittest.mock as mock
except ImportError:
    import mock

try:
    from pathlib2 import Path
except ImportError:
    from pathlib import Path

import os

# third party imports
import pytest


# Module Vars / Constants
class Vars:
    tmpdir_factory = None
    tmpdir_home = None
    tmpdir_data = None
    extrasession_mockers = []


def pytest_sessionstart(session):
    """ pytest_sessionstart hook

    This runs *before* import and collection of tests.

    This is *THE* place to do mocking of things that are global,
    such as `appdirs`.

    Do teardown in `pytest_sessionfinish()`
    """
    print("Pre-Session Setup..")
    # Figuring out how to use the pytest tmpdir fixture externally was kinda awful.
    Vars.tmpdir_home = pytest.ensuretemp('fake_home')
    Vars.tmpdir_data = Vars.tmpdir_home.mkdir('appdirs_datadir')

    user_data_dir = lambda *x: str(Vars.tmpdir_data / x[0] if x else Vars.tmpdir_data)

    # Mockers that need to be loaded before any of our code
    Vars.extrasession_mockers.extend([
        mock.patch('appdirs.user_data_dir', user_data_dir)
    ])

    for mocker in Vars.extrasession_mockers:
        mocker.start()


def pytest_sessionfinish(session, exitstatus):
    """ pytest_sessionfinish hook

    This runs *after* any finalizers or other session activities.

    Performs teardown for `pytest_sessionstart()`
    """
    print("\nPost-session Teardown..")

    for mocker in Vars.extrasession_mockers:
        mocker.stop()


# scope: function, class, module, or session
# autouse: boolean.  Apply to all instances of the given scope.
@pytest.fixture(scope='session', autouse=True)
def each_session(request):
    print("\nSetup session..")

    def teardown():  # can be named whatever
        print("\nTeardown session..")

    request.addfinalizer(teardown)


@pytest.fixture(scope='function', autouse=True)
def set_temporary_working_dir(request, tmpdir):
    print("Setting tempdir to {}".format(tmpdir))
    orig_dir = os.getcwd()
    os.chdir(tmpdir)

    def teardown():  # can be named whatever
        print("Unsetting tempdir..")
        os.chdir(orig_dir)

    request.addfinalizer(teardown)
