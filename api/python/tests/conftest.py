import os
import pathlib
import shutil
import sys
import tempfile
from functools import partial
from unittest import mock

import pytest

from .fixtures.admin_graphql_responses import (
    ROLES_LIST_RESPONSE,
    SSO_CONFIG_GET_RESPONSE,
    TABULATOR_GET_OPEN_QUERY_RESPONSE,
    TABULATOR_SET_OPEN_QUERY_RESPONSE,
    TABULATOR_TABLE_RENAME_SUCCESS_RESPONSE,
    TABULATOR_TABLE_SET_SUCCESS_RESPONSE,
    TABULATOR_TABLES_LIST_RESPONSE,
    USERS_ADD_ROLES_SUCCESS_RESPONSE,
    USERS_CREATE_SUCCESS_RESPONSE,
    USERS_GET_RESPONSE,
    USERS_LIST_RESPONSE,
    USERS_REMOVE_ROLES_SUCCESS_RESPONSE,
    USERS_SET_ACTIVE_SUCCESS_RESPONSE,
    USERS_SET_ADMIN_SUCCESS_RESPONSE,
    USERS_SET_EMAIL_SUCCESS_RESPONSE,
    USERS_SET_ROLE_SUCCESS_RESPONSE,
)
from .graphql_operation_router import GraphQLOperationRouter


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
    such as `platformdirs`.

    Do teardown in `pytest_sessionfinish()`
    """
    print("Pre-Session Setup..")
    # Looks like there's no public API to get the resolved value of pytest base temp dir
    # (https://docs.pytest.org/en/6.2.x/tmpdir.html#the-default-base-temporary-directory).
    Vars.tmpdir_home = pathlib.Path(tempfile.mkdtemp(prefix='pytest-fake_home'))
    Vars.tmpdir_data = Vars.tmpdir_home / 'platformdirs_datadir'
    Vars.tmpdir_data.mkdir()
    Vars.tmpdir_cache = Vars.tmpdir_home / 'platformdirs_cachedir'
    Vars.tmpdir_cache.mkdir()

    def get_dir(*args, d):
        return str(d / args[0] if args else d)

    # Mockers that need to be loaded before any of our code
    Vars.extrasession_mockers.extend([
        mock.patch('platformdirs.user_data_dir', partial(get_dir, d=Vars.tmpdir_data)),
        mock.patch('platformdirs.user_cache_dir', partial(get_dir, d=Vars.tmpdir_cache)),
    ])

    for mocker in Vars.extrasession_mockers:
        mocker.start()


def pytest_sessionfinish(session, exitstatus):
    """ pytest_sessionfinish hook

    This runs *after* any finalizers or other session activities.

    Performs teardown for `pytest_sessionstart()`
    """
    print("\nPost-session Teardown..")

    shutil.rmtree(Vars.tmpdir_home)
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


@pytest.fixture
def isolate_packages_cache(tmp_path):
    with mock.patch('quilt3.packages.CACHE_PATH', tmp_path):
        yield


@pytest.fixture
def clear_data_modules_cache():
    to_remove = [
        name
        for name in sys.modules
        if name.split('.')[:2] == ['quilt3', 'data']
    ]
    for name in to_remove:
        del sys.modules[name]


@pytest.fixture
def graphql_router():
    """Provide a configured GraphQL operation router for admin testing."""
    router = GraphQLOperationRouter()

    # Pre-configure common successful responses
    router.add_response("rolesList", ROLES_LIST_RESPONSE)
    router.add_response("usersList", USERS_LIST_RESPONSE)
    router.add_response("usersGet", USERS_GET_RESPONSE)
    router.add_response("usersCreate", USERS_CREATE_SUCCESS_RESPONSE)
    router.add_response("ssoConfigGet", SSO_CONFIG_GET_RESPONSE)
    router.add_response("bucketTabulatorTablesList", TABULATOR_TABLES_LIST_RESPONSE)
    router.add_response("tabulatorGetOpenQuery", TABULATOR_GET_OPEN_QUERY_RESPONSE)

    # User mutation responses
    router.add_response("usersSetEmail", USERS_SET_EMAIL_SUCCESS_RESPONSE)
    router.add_response("usersSetAdmin", USERS_SET_ADMIN_SUCCESS_RESPONSE)
    router.add_response("usersSetActive", USERS_SET_ACTIVE_SUCCESS_RESPONSE)
    router.add_response("usersSetRole", USERS_SET_ROLE_SUCCESS_RESPONSE)
    router.add_response("usersAddRoles", USERS_ADD_ROLES_SUCCESS_RESPONSE)
    router.add_response("usersRemoveRoles", USERS_REMOVE_ROLES_SUCCESS_RESPONSE)

    # Tabulator mutation responses
    router.add_response("bucketTabulatorTableSet", TABULATOR_TABLE_SET_SUCCESS_RESPONSE)
    router.add_response("bucketTabulatorTableRename", TABULATOR_TABLE_RENAME_SUCCESS_RESPONSE)
    router.add_response("tabulatorSetOpenQuery", TABULATOR_SET_OPEN_QUERY_RESPONSE)

    return router


@pytest.fixture
def mock_admin_client(graphql_router):
    """Provide admin client with mocked GraphQL calls using the operation router."""
    with mock.patch("quilt3.session.get_registry_url", return_value="https://registry.example.com"):
        with mock.patch("quilt3._graphql_client.Client.execute",
                        return_value=mock.sentinel.RESPONSE) as execute_mock:
            with mock.patch("quilt3._graphql_client.Client.get_data") as get_data_mock:
                # Configure get_data to route through our operation router
                def mock_get_data(response):
                    # Extract operation details from the last execute call
                    if execute_mock.call_args:
                        kwargs = execute_mock.call_args.kwargs
                        query = kwargs.get('query', '')
                        operation_name = kwargs.get('operation_name')
                        variables = kwargs.get('variables', {})

                        return graphql_router.route_operation(query, operation_name, variables)

                    # Fallback for edge cases
                    return graphql_router.responses.get('default', {})

                get_data_mock.side_effect = mock_get_data
                yield execute_mock
