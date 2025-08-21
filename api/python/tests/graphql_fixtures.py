"""GraphQL fixtures for admin API testing."""

from unittest import mock

import pytest

from .fixtures.admin_graphql_responses import (
    ROLES_LIST_RESPONSE, SSO_CONFIG_GET_RESPONSE,
    TABULATOR_GET_OPEN_QUERY_RESPONSE, TABULATOR_SET_OPEN_QUERY_RESPONSE,
    TABULATOR_TABLE_RENAME_SUCCESS_RESPONSE,
    TABULATOR_TABLE_SET_SUCCESS_RESPONSE, TABULATOR_TABLES_LIST_RESPONSE,
    USERS_ADD_ROLES_SUCCESS_RESPONSE, USERS_CREATE_SUCCESS_RESPONSE,
    USERS_GET_RESPONSE, USERS_LIST_RESPONSE,
    USERS_REMOVE_ROLES_SUCCESS_RESPONSE, USERS_SET_ACTIVE_SUCCESS_RESPONSE,
    USERS_SET_ADMIN_SUCCESS_RESPONSE, USERS_SET_EMAIL_SUCCESS_RESPONSE,
    USERS_SET_ROLE_SUCCESS_RESPONSE)
from .graphql_operation_router import GraphQLOperationRouter


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
