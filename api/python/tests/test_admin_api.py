import contextlib
import datetime
from unittest import mock

import pytest

from quilt3 import admin
from quilt3.admin import _graphql_client

UNMANAGED_ROLE = {
    "__typename": "UnmanagedRole",
    "id": "d7d15bef-c482-4086-ae6b-d0372b6145d2",
    "name": "UnmanagedRole",
    "arn": "arn:aws:iam::000000000000:role/UnmanagedRole",
}
MANAGED_ROLE = {
    "__typename": "ManagedRole",
    "id": "b1bab604-98fd-4b46-a20b-958cf2541c91",
    "name": "ManagedRole",
    "arn": "arn:aws:iam::000000000000:role/ManagedRole",
}
USER = {
    "__typename": "User",
    "name": "test",
    "email": "test@example.com",
    "dateJoined": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "lastLogin": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "isActive": True,
    "isAdmin": False,
    "isSsoOnly": False,
    "isService": False,
    "role": UNMANAGED_ROLE,
    "extraRoles": [MANAGED_ROLE],
}
SSO_CONFIG = {
    "__typename": "SsoConfig",
    "text": "",
    "timestamp": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "uploader": USER,
}
TABULATOR_TABLE = {
    "name": "table",
    "config": "config",
}
MUTATION_ERRORS = (
    (
        {
            "__typename": "InvalidInput",
            "errors": [
                {
                    "path": "error path",
                    "message": "error message",
                    "name": "error name",
                    "context": {},
                }
            ],
        },
        admin.Quilt3AdminError,
    ),
    (
        {
            "__typename": "OperationError",
            "message": "error message",
            "name": "error name",
            "context": {},
        },
        admin.Quilt3AdminError,
    ),
)
USER_MUTATION_ERRORS = (
    *MUTATION_ERRORS,
    (None, admin.UserNotFoundError),
)


def _camel_to_snake(name: str) -> str:
    return "".join("_" + c.lower() if c.isupper() else c for c in name).lstrip("_")


def _as_dataclass_kwargs(data: dict) -> dict:
    return {
        "typename__" if k == "__typename" else _camel_to_snake(k): (
            _as_dataclass_kwargs(v)
            if isinstance(v, dict)
            else [_as_dataclass_kwargs(x) for x in v]
            if isinstance(v, list)
            else v
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
            "quilt3.admin._graphql_client.Client.execute", return_value=mock.sentinel.RESPONSE
        ) as execute_mock:
            with mock.patch("quilt3.admin._graphql_client.Client.get_data", return_value=data) as get_data_mock:
                yield

    execute_mock.assert_called_once_with(query=mock.ANY, operation_name=operation_name, variables=variables or {})
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
    with mock_client(_make_nested_dict("admin.user.get", data), "usersGet", variables={"name": "test"}):
        assert admin.users.get("test") == result


def test_get_users():
    with mock_client(_make_nested_dict("admin.user.list", [USER]), "usersList"):
        assert admin.users.list() == [admin.User(**_as_dataclass_kwargs(USER))]


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
            assert admin.users.remove_roles("test", ["ManagedRole"], fallback="UnamanagedRole") == result


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
    with mock_client(_make_nested_dict("admin.set_sso_config", data), "ssoConfigSet", variables={"config": ""}):
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
# FOCUSED COVERAGE IMPROVEMENTS FOR GRAPHQL CLIENT EXCEPTIONS
# =============================================================================


def test_graphql_client_http_error():
    """Test GraphQLClientHttpError exception."""
    from quilt3.admin._graphql_client.exceptions import GraphQLClientHttpError
    import requests

    # Create a mock response
    response = mock.Mock(spec=requests.Response)
    response.status_code = 500

    error = GraphQLClientHttpError(500, response)
    assert error.status_code == 500
    assert error.response == response
    assert str(error) == "HTTP status code: 500"


def test_graphql_client_invalid_response_error():
    """Test GraphQLClientInvalidResponseError exception."""
    from quilt3.admin._graphql_client.exceptions import GraphQLClientInvalidResponseError
    import requests

    response = mock.Mock(spec=requests.Response)
    error = GraphQLClientInvalidResponseError(response)
    assert error.response == response
    assert str(error) == "Invalid response format."


def test_graphql_client_graphql_error():
    """Test GraphQLClientGraphQLError exception."""
    from quilt3.admin._graphql_client.exceptions import GraphQLClientGraphQLError

    # Test basic construction
    error = GraphQLClientGraphQLError("Test error")
    assert error.message == "Test error"
    assert error.locations is None
    assert error.path is None
    assert error.extensions is None
    assert str(error) == "Test error"

    # Test with all fields
    error = GraphQLClientGraphQLError(
        message="Field error",
        locations=[{"line": 1, "column": 5}],
        path=["user", "name"],
        extensions={"code": "VALIDATION_ERROR"},
        orginal={"message": "Field error"},
    )
    assert error.message == "Field error"
    assert error.locations == [{"line": 1, "column": 5}]
    assert error.path == ["user", "name"]
    assert error.extensions == {"code": "VALIDATION_ERROR"}

    # Test from_dict
    error_dict = {
        "message": "Field required",
        "locations": [{"line": 2, "column": 3}],
        "path": ["input", "email"],
        "extensions": {"code": "REQUIRED"},
    }
    error = GraphQLClientGraphQLError.from_dict(error_dict)
    assert error.message == "Field required"
    assert error.locations == [{"line": 2, "column": 3}]
    assert error.path == ["input", "email"]
    assert error.extensions == {"code": "REQUIRED"}
    assert error.orginal == error_dict


def test_graphql_client_multi_error():
    """Test GraphQLClientGraphQLMultiError exception."""
    from quilt3.admin._graphql_client.exceptions import GraphQLClientGraphQLError, GraphQLClientGraphQLMultiError

    # Create individual errors
    error1 = GraphQLClientGraphQLError("Error 1")
    error2 = GraphQLClientGraphQLError("Error 2")

    # Test multi error
    multi_error = GraphQLClientGraphQLMultiError([error1, error2])
    assert len(multi_error.errors) == 2
    assert multi_error.data is None
    assert str(multi_error) == "Error 1; Error 2"

    # Test with data
    multi_error = GraphQLClientGraphQLMultiError([error1], data={"partial": "data"})
    assert multi_error.data == {"partial": "data"}

    # Test from_errors_dicts
    error_dicts = [{"message": "First error"}, {"message": "Second error"}]
    multi_error = GraphQLClientGraphQLMultiError.from_errors_dicts(error_dicts, data={"some": "data"})
    assert len(multi_error.errors) == 2
    assert multi_error.errors[0].message == "First error"
    assert multi_error.errors[1].message == "Second error"
    assert multi_error.data == {"some": "data"}


def test_graphql_client_invalid_message_format():
    """Test GraphQLClientInvalidMessageFormat exception."""
    from quilt3.admin._graphql_client.exceptions import GraphQLClientInvalidMessageFormat

    # Test with string message
    error = GraphQLClientInvalidMessageFormat("Invalid JSON")
    assert error.message == "Invalid JSON"
    assert str(error) == "Invalid message format."

    # Test with bytes message
    error = GraphQLClientInvalidMessageFormat(b"Invalid bytes")
    assert error.message == b"Invalid bytes"
    assert str(error) == "Invalid message format."
