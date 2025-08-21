"""Tests for Quilt3 admin API functionality."""

import contextlib
from unittest import mock

import pytest

from quilt3 import _graphql_client, admin

from .fixtures.admin_graphql_responses import (
    INVALID_INPUT_ERROR,
    MANAGED_ROLE,
    MUTATION_ERRORS,
    OPERATION_ERROR,
    ROLES_LIST_RESPONSE,
    SSO_CONFIG,
    SSO_CONFIG_GET_NOT_FOUND_RESPONSE,
    SSO_CONFIG_SET_SUCCESS_RESPONSE,
    SSO_CONFIG_SET_VALIDATION_ERROR_RESPONSE,
    TABULATOR_TABLE,
    TABULATOR_TABLES_BUCKET_NOT_FOUND_RESPONSE,
    UNMANAGED_ROLE,
    USER,
    USER_MUTATION_NOT_FOUND_RESPONSE,
    USERS_CREATE_OPERATION_ERROR_RESPONSE,
    USERS_CREATE_VALIDATION_ERROR_RESPONSE,
    USERS_GET_NOT_FOUND_RESPONSE,
    USERS_LIST_RESPONSE,
)
from .fixtures.graphql_schema_fragments import (
    validate_graphql_response_structure,
    validate_role_response,
    validate_sso_config_response,
    validate_tabulator_table_response,
    validate_user_response,
)

USER_MUTATION_ERRORS = (
    (INVALID_INPUT_ERROR, admin.Quilt3AdminError),
    (OPERATION_ERROR, admin.Quilt3AdminError),
    (None, admin.UserNotFoundError),
)


def _camel_to_snake(name: str) -> str:
    return "".join("_" + c.lower() if c.isupper() else c for c in name).lstrip("_")


def _as_dataclass_kwargs(data: dict) -> dict:
    return {
        "typename__" if k == "__typename" else _camel_to_snake(k): (
            _as_dataclass_kwargs(v)
            if isinstance(v, dict)
            else [_as_dataclass_kwargs(x) for x in v] if isinstance(v, list) else v
        )
        for k, v in data.items()
    }


def _make_nested_dict(path: str, value) -> dict:
    if "." in path:
        key, rest = path.split(".", 1)
        return {key: _make_nested_dict(rest, value)}
    return {path: value}


@contextlib.contextmanager
def mock_client(data, operation_name, variables=None):
    with mock.patch("quilt3.session.get_registry_url", return_value="https://registry.example.com"):
        with mock.patch(
            "quilt3._graphql_client.Client.execute", return_value=mock.sentinel.RESPONSE
        ) as execute_mock:
            with mock.patch(
                "quilt3._graphql_client.Client.get_data", return_value=data
            ) as get_data_mock:
                yield

    execute_mock.assert_called_once_with(
        query=mock.ANY, operation_name=operation_name, variables=variables or {}
    )
    get_data_mock.assert_called_once_with(mock.sentinel.RESPONSE)


def test_get_roles():
    with mock_client({"roles": [UNMANAGED_ROLE, MANAGED_ROLE]}, "rolesList"):
        assert admin.roles.list() == [
            admin.UnmanagedRole(**_as_dataclass_kwargs(UNMANAGED_ROLE)),
            admin.ManagedRole(**_as_dataclass_kwargs(MANAGED_ROLE)),
        ]


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, admin.User(**_as_dataclass_kwargs(USER))),
        (None, None),
    ],
)
def test_get_user(data, result):
    with mock_client(
        _make_nested_dict("admin.user.get", data), "usersGet", variables={"name": "test"}
    ):
        assert admin.users.get("test") == result


def test_get_users():
    with mock_client(_make_nested_dict("admin.user.list", [USER]), "usersList"):
        assert admin.users.list_users() == [admin.User(**_as_dataclass_kwargs(USER))]


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, admin.User(**_as_dataclass_kwargs(USER))),
        *MUTATION_ERRORS,
    ],
)
def test_create_user(data, result):
    with mock_client(
        _make_nested_dict("admin.user.create", data),
        "usersCreate",
        variables={
            "input": _graphql_client.UserInput(
                name="test", email="test@example.com", role="UnmanagedRole", extraRoles=[]
            )
        },
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.users.create("test", "test@example.com", "UnmanagedRole", [])
        else:
            assert admin.users.create("test", "test@example.com", "UnmanagedRole", []) == result


@pytest.mark.parametrize(
    "data,result",
    MUTATION_ERRORS,
)
def test_delete_user(data, result):
    with mock_client(
        _make_nested_dict("admin.user.mutate.delete", data),
        "usersDelete",
        variables={"name": "test"},
    ):
        with pytest.raises(result):
            admin.users.delete("test")


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, admin.User(**_as_dataclass_kwargs(USER))),
        *USER_MUTATION_ERRORS,
    ],
)
def test_set_user_email(data, result):
    with mock_client(
        (
            _make_nested_dict("admin.user.mutate", None)
            if data is None
            else _make_nested_dict("admin.user.mutate.setEmail", data)
        ),
        "usersSetEmail",
        variables={"name": "test", "email": "test@example.com"},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.users.set_email("test", "test@example.com")
        else:
            assert admin.users.set_email("test", "test@example.com") == result


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, admin.User(**_as_dataclass_kwargs(USER))),
        *USER_MUTATION_ERRORS,
    ],
)
def test_set_user_admin(data, result):
    with mock_client(
        (
            _make_nested_dict("admin.user.mutate", None)
            if data is None
            else _make_nested_dict("admin.user.mutate.setAdmin", data)
        ),
        "usersSetAdmin",
        variables={"name": "test", "admin": True},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.users.set_admin("test", True)
        else:
            assert admin.users.set_admin("test", True) == result


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, admin.User(**_as_dataclass_kwargs(USER))),
        *USER_MUTATION_ERRORS,
    ],
)
def test_set_user_active(data, result):
    with mock_client(
        (
            _make_nested_dict("admin.user.mutate", None)
            if data is None
            else _make_nested_dict("admin.user.mutate.setActive", data)
        ),
        "usersSetActive",
        variables={"name": "test", "active": True},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.users.set_active("test", True)
        else:
            assert admin.users.set_active("test", True) == result


@pytest.mark.parametrize(
    "data,result",
    USER_MUTATION_ERRORS,
)
def test_reset_user_password(data, result):
    with mock_client(
        (
            _make_nested_dict("admin.user.mutate", None)
            if data is None
            else _make_nested_dict("admin.user.mutate.resetPassword", data)
        ),
        "usersResetPassword",
        variables={"name": "test"},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.users.reset_password("test")
        else:
            assert admin.users.reset_password("test") == result


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, admin.User(**_as_dataclass_kwargs(USER))),
        *USER_MUTATION_ERRORS,
    ],
)
def test_set_role(data, result):
    with mock_client(
        (
            _make_nested_dict("admin.user.mutate", None)
            if data is None
            else _make_nested_dict("admin.user.mutate.setRole", data)
        ),
        "usersSetRole",
        variables={"name": "test", "role": "UnamangedRole", "extraRoles": [], "append": True},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.users.set_role("test", "UnamangedRole", [], append=True)
        else:
            assert admin.users.set_role("test", "UnamangedRole", [], append=True) == result


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, admin.User(**_as_dataclass_kwargs(USER))),
        *USER_MUTATION_ERRORS,
    ],
)
def test_add_roles(data, result):
    with mock_client(
        (
            _make_nested_dict("admin.user.mutate", None)
            if data is None
            else _make_nested_dict("admin.user.mutate.addRoles", data)
        ),
        "usersAddRoles",
        variables={"name": "test", "roles": ["ManagedRole"]},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.users.add_roles("test", ["ManagedRole"])
        else:
            assert admin.users.add_roles("test", ["ManagedRole"]) == result


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, admin.User(**_as_dataclass_kwargs(USER))),
        *USER_MUTATION_ERRORS,
    ],
)
def test_remove_roles(data, result):
    with mock_client(
        (
            _make_nested_dict("admin.user.mutate", None)
            if data is None
            else _make_nested_dict("admin.user.mutate.removeRoles", data)
        ),
        "usersRemoveRoles",
        variables={"name": "test", "roles": ["ManagedRole"], "fallback": "UnamanagedRole"},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.users.remove_roles("test", ["ManagedRole"], fallback="UnamanagedRole")
        else:
            assert admin.users.remove_roles(
                "test", ["ManagedRole"], fallback="UnamanagedRole"
            ) == result


@pytest.mark.parametrize(
    "data,result",
    [
        (SSO_CONFIG, admin.SSOConfig(**_as_dataclass_kwargs(SSO_CONFIG))),
        (None, None),
    ],
)
def test_sso_config_get(data, result):
    with mock_client(_make_nested_dict("admin.sso_config", data), "ssoConfigGet"):
        assert admin.sso_config.get() == result


@pytest.mark.parametrize(
    "data,result",
    [
        (SSO_CONFIG, admin.SSOConfig(**_as_dataclass_kwargs(SSO_CONFIG))),
        (None, None),
        *MUTATION_ERRORS,
    ],
)
def test_sso_config_set(data, result):
    with mock_client(
        _make_nested_dict("admin.set_sso_config", data), "ssoConfigSet", variables={"config": ""}
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.sso_config.set("")
        else:
            assert admin.sso_config.set("") == result


@pytest.mark.parametrize(
    "data, result",
    [
        ({"tabulator_tables": [TABULATOR_TABLE]}, [admin.TabulatorTable(**TABULATOR_TABLE)]),
        (None, admin.BucketNotFoundError),
    ],
)
def test_tabulator_list(data, result):
    with mock_client(
        _make_nested_dict("bucket_config", data),
        "bucketTabulatorTablesList",
        variables={"name": "test"},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.tabulator.list_tables("test")
        else:
            assert admin.tabulator.list_tables("test") == result


@pytest.mark.parametrize(
    "data,result",
    [
        ({"__typename": "BucketConfig"}, None),
        *MUTATION_ERRORS,
    ],
)
def test_tabulator_set(data, result):
    with mock_client(
        _make_nested_dict("admin.bucket_set_tabulator_table", data),
        "bucketTabulatorTableSet",
        variables={"bucketName": "test", "tableName": "table", "config": ""},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.tabulator.set_table("test", "table", "")
        else:
            assert admin.tabulator.set_table("test", "table", "") == result


@pytest.mark.parametrize(
    "data,result",
    [
        ({"__typename": "BucketConfig"}, None),
        *MUTATION_ERRORS,
    ],
)
def test_tabulator_rename(data, result):
    with mock_client(
        _make_nested_dict("admin.bucket_rename_tabulator_table", data),
        "bucketTabulatorTableRename",
        variables={"bucketName": "test", "tableName": "table", "newTableName": "new_table"},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.tabulator.rename_table("test", "table", "new_table")
        else:
            assert admin.tabulator.rename_table("test", "table", "new_table") == result


def test_tabulator_get_open_query():
    with mock_client(
        _make_nested_dict("admin.tabulator_open_query", True),
        "tabulatorGetOpenQuery",
    ):
        assert admin.tabulator.get_open_query() is True


def test_tabulator_set_open_query():
    with mock_client(
        _make_nested_dict("admin.set_tabulator_open_query.tabulator_open_query", True),
        "tabulatorSetOpenQuery",
        variables={"enabled": True},
    ):
        assert admin.tabulator.set_open_query(True) is None


# =============================================================================
# NEW COMPREHENSIVE TESTS USING GRAPHQL MOCK INFRASTRUCTURE
# =============================================================================

class TestUserOperationsWithMockServer:
    """Comprehensive test coverage for user operations using GraphQL mock server."""

    def test_users_list_with_mock_server(self, mock_admin_client, graphql_router):
        """Test listing users with the new mock infrastructure."""
        users = admin.users.list_users()

        # Verify the call was made
        assert graphql_router.get_call_count("usersList") == 1

        # Verify response structure
        assert len(users) == 1
        assert users[0].name == "test"
        assert users[0].email == "test@example.com"
        assert validate_user_response(users[0].__dict__)

    def test_users_get_success(self, mock_admin_client, graphql_router):
        """Test getting a user that exists."""
        user = admin.users.get("test")

        assert graphql_router.get_call_count("usersGet") == 1
        assert user is not None
        assert user.name == "test"
        assert validate_user_response(user.__dict__)

    def test_users_get_not_found(self, mock_admin_client, graphql_router):
        """Test getting a user that doesn't exist."""
        graphql_router.add_response("usersGet", USERS_GET_NOT_FOUND_RESPONSE)

        user = admin.users.get("nonexistent")

        assert graphql_router.get_call_count("usersGet") == 1
        assert user is None

    def test_users_create_success(self, mock_admin_client, graphql_router):
        """Test successful user creation."""
        user = admin.users.create("newuser", "new@example.com", "UnmanagedRole", [])

        assert graphql_router.get_call_count("usersCreate") == 1
        assert user.name == "test"  # Using fixture response
        assert validate_user_response(user.__dict__)

        # Verify call parameters
        last_call = graphql_router.get_last_call("usersCreate")
        assert "input" in last_call["variables"]

    def test_users_create_validation_error(self, mock_admin_client, graphql_router):
        """Test user creation with validation errors."""
        graphql_router.add_response("usersCreate", USERS_CREATE_VALIDATION_ERROR_RESPONSE)

        with pytest.raises(admin.Quilt3AdminError):
            admin.users.create("newuser", "invalid-email", "UnmanagedRole", [])

    def test_users_create_operation_error(self, mock_admin_client, graphql_router):
        """Test user creation with operation errors."""
        graphql_router.add_response("usersCreate", USERS_CREATE_OPERATION_ERROR_RESPONSE)

        with pytest.raises(admin.Quilt3AdminError):
            admin.users.create("newuser", "new@example.com", "UnmanagedRole", [])

    def test_user_mutations_success(self, mock_admin_client, graphql_router):
        """Test successful user mutation operations."""
        mutations = [
            ("usersSetEmail", lambda: admin.users.set_email("test", "new@example.com")),
            ("usersSetAdmin", lambda: admin.users.set_admin("test", True)),
            ("usersSetActive", lambda: admin.users.set_active("test", False)),
        ]

        for operation_name, operation in mutations:
            result = operation()
            assert graphql_router.get_call_count(operation_name) == 1
            assert result.name == "test"
            assert validate_user_response(result.__dict__)

    def test_user_mutations_not_found(self, mock_admin_client, graphql_router):
        """Test user mutations when user doesn't exist."""
        operations = [
            ("usersSetEmail", lambda: admin.users.set_email("nonexistent", "new@example.com")),
            ("usersSetAdmin", lambda: admin.users.set_admin("nonexistent", True)),
            ("usersSetActive", lambda: admin.users.set_active("nonexistent", False)),
        ]

        for operation_name, operation in operations:
            graphql_router.add_response(operation_name, USER_MUTATION_NOT_FOUND_RESPONSE)

            with pytest.raises(admin.UserNotFoundError):
                operation()


class TestRoleOperationsWithMockServer:
    """Test role operations using GraphQL mock server."""

    def test_roles_list(self, mock_admin_client, graphql_router):
        """Test listing roles."""
        roles = admin.roles.list()

        assert graphql_router.get_call_count("rolesList") == 1
        assert len(roles) == 2

        # Verify role types and structure
        unmanaged_role = next(r for r in roles if r.__class__.__name__ == "UnmanagedRole")
        managed_role = next(r for r in roles if r.__class__.__name__ == "ManagedRole")

        assert unmanaged_role.name == "UnmanagedRole"
        assert managed_role.name == "ManagedRole"


class TestSSOConfigWithMockServer:
    """Test SSO configuration operations using GraphQL mock server."""

    def test_sso_config_get_success(self, mock_admin_client, graphql_router):
        """Test getting SSO configuration when it exists."""
        config = admin.sso_config.get()

        assert graphql_router.get_call_count("ssoConfigGet") == 1
        assert config is not None
        assert config.text == ""
        assert validate_sso_config_response(config.__dict__)

    def test_sso_config_get_not_found(self, mock_admin_client, graphql_router):
        """Test getting SSO configuration when it doesn't exist."""
        graphql_router.add_response("ssoConfigGet", SSO_CONFIG_GET_NOT_FOUND_RESPONSE)

        config = admin.sso_config.get()

        assert graphql_router.get_call_count("ssoConfigGet") == 1
        assert config is None

    def test_sso_config_set_success(self, mock_admin_client, graphql_router):
        """Test setting SSO configuration successfully."""
        graphql_router.add_response("ssoConfigSet", SSO_CONFIG_SET_SUCCESS_RESPONSE)

        config = admin.sso_config.set("new config")

        assert graphql_router.get_call_count("ssoConfigSet") == 1
        assert config is not None
        assert validate_sso_config_response(config.__dict__)

    def test_sso_config_set_validation_error(self, mock_admin_client, graphql_router):
        """Test SSO configuration validation errors."""
        graphql_router.add_response("ssoConfigSet", SSO_CONFIG_SET_VALIDATION_ERROR_RESPONSE)

        with pytest.raises(admin.Quilt3AdminError):
            admin.sso_config.set("invalid config")


class TestTabulatorWithMockServer:
    """Test tabulator operations using GraphQL mock server."""

    def test_tabulator_list_tables_success(self, mock_admin_client, graphql_router):
        """Test listing tabulator tables successfully."""
        tables = admin.tabulator.list_tables("test-bucket")

        assert graphql_router.get_call_count("bucketTabulatorTablesList") == 1
        assert len(tables) == 1
        assert tables[0].name == "table"
        assert validate_tabulator_table_response(tables[0].__dict__)

    def test_tabulator_list_tables_bucket_not_found(self, mock_admin_client, graphql_router):
        """Test listing tables for non-existent bucket."""
        graphql_router.add_response(
            "bucketTabulatorTablesList", TABULATOR_TABLES_BUCKET_NOT_FOUND_RESPONSE
        )

        with pytest.raises(admin.BucketNotFoundError):
            admin.tabulator.list_tables("nonexistent-bucket")

    def test_tabulator_set_table_success(self, mock_admin_client, graphql_router):
        """Test setting tabulator table configuration."""
        admin.tabulator.set_table("test-bucket", "test-table", "config")

        assert graphql_router.get_call_count("bucketTabulatorTableSet") == 1

    def test_tabulator_rename_table_success(self, mock_admin_client, graphql_router):
        """Test renaming tabulator table."""
        admin.tabulator.rename_table("test-bucket", "old-table", "new-table")

        assert graphql_router.get_call_count("bucketTabulatorTableRename") == 1

    def test_tabulator_get_open_query(self, mock_admin_client, graphql_router):
        """Test getting tabulator open query setting."""
        result = admin.tabulator.get_open_query()

        assert graphql_router.get_call_count("tabulatorGetOpenQuery") == 1
        assert result is True

    def test_tabulator_set_open_query(self, mock_admin_client, graphql_router):
        """Test setting tabulator open query setting."""
        admin.tabulator.set_open_query(False)

        assert graphql_router.get_call_count("tabulatorSetOpenQuery") == 1


class TestErrorHandlingWithMockServer:
    """Test comprehensive error handling scenarios."""

    def test_network_simulation(self, mock_admin_client, graphql_router):
        """Test handling of simulated network errors."""
        # Remove the response to simulate missing endpoint
        graphql_router.responses.clear()

        with pytest.raises(KeyError):  # No mock response configured
            admin.users.list_users()

    def test_invalid_graphql_response_structure(self, mock_admin_client, graphql_router):
        """Test handling of malformed GraphQL responses."""
        # Add malformed response
        graphql_router.add_response("usersList", {"invalid": "structure"})

        with pytest.raises(Exception):  # Should fail to parse
            admin.users.list_users()

    def test_response_validation(self, graphql_router):
        """Test that our mock responses are valid."""
        # Validate user response structure
        user_data = USERS_LIST_RESPONSE["admin"]["user"]["list"][0]
        assert validate_user_response(user_data)

        # Validate role response structure
        role_data = ROLES_LIST_RESPONSE["roles"][0]
        assert validate_role_response(role_data)

        # Validate GraphQL response structure
        assert validate_graphql_response_structure(USERS_LIST_RESPONSE, "admin.user.list")
        assert validate_graphql_response_structure(ROLES_LIST_RESPONSE, "roles")


class TestMockServerInfrastructure:
    """Test the mock server infrastructure itself."""

    def test_operation_routing(self, graphql_router):
        """Test that operations are routed correctly."""
        # Test manual operation routing
        result = graphql_router.route_operation(
            query="query usersList { admin { user { list } } }",
            operation_name="usersList"
        )

        assert result == USERS_LIST_RESPONSE
        assert graphql_router.get_call_count("usersList") == 1

    def test_call_history_tracking(self, graphql_router):
        """Test that call history is tracked properly."""
        # Make some calls
        graphql_router.route_operation("query usersList", "usersList")
        graphql_router.route_operation("query usersGet", "usersGet", {"name": "test"})

        # Check history
        assert len(graphql_router.call_history) == 2
        assert graphql_router.get_call_count("usersList") == 1
        assert graphql_router.get_call_count("usersGet") == 1

        # Check last call details
        last_call = graphql_router.get_last_call("usersGet")
        assert last_call["variables"]["name"] == "test"

    def test_router_reset(self, graphql_router):
        """Test that router can be reset properly."""
        # Add some data
        graphql_router.add_response("test", {"data": "test"})
        graphql_router.route_operation("query test", "test")
        assert len(graphql_router.call_history) > 0
        assert len(graphql_router.responses) > 0

        # Reset and verify
        graphql_router.reset()
        assert len(graphql_router.call_history) == 0
        assert len(graphql_router.responses) == 0
