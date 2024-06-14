import contextlib
import datetime
from unittest import mock

import pytest

from quilt3 import admin

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
            "quilt3.admin._graphql_client.Client.execute", return_value=mock.sentinel.RESPONSE
        ) as execute_mock:
            with mock.patch("quilt3.admin._graphql_client.Client.get_data", return_value=data) as get_data_mock:
                yield

    execute_mock.assert_called_once_with(query=mock.ANY, operation_name=operation_name, variables=variables or {})
    get_data_mock.assert_called_once_with(mock.sentinel.RESPONSE)


def test_get_roles():
    with mock_client({"roles": [UNMANAGED_ROLE, MANAGED_ROLE]}, "getRoles"):
        assert admin.get_roles() == [
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
    with mock_client(_make_nested_dict("admin.user.get", data), "getUser", variables={"name": "test"}):
        assert admin.get_user("test") == result


def test_get_users():
    with mock_client(_make_nested_dict("admin.user.list", [USER]), "getUsers"):
        assert admin.get_users() == [admin.User(**_as_dataclass_kwargs(USER))]


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
        "createUser",
        variables={
            "input": admin._graphql_client.UserInput(
                name="test", email="test@example.com", role="UnmanagedRole", extraRoles=[]
            )
        },
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.create_user("test", "test@example.com", "UnmanagedRole", [])
        else:
            assert admin.create_user("test", "test@example.com", "UnmanagedRole", []) == result


@pytest.mark.parametrize(
    "data,result",
    MUTATION_ERRORS,
)
def test_delete_user(data, result):
    with mock_client(
        _make_nested_dict("admin.user.mutate.delete", data),
        "deleteUser",
        variables={"name": "test"},
    ):
        with pytest.raises(result):
            admin.delete_user("test")


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
        "setUserEmail",
        variables={"name": "test", "email": "test@example.com"},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.set_user_email("test", "test@example.com")
        else:
            assert admin.set_user_email("test", "test@example.com") == result


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
        "setUserAdmin",
        variables={"name": "test", "admin": True},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.set_user_admin("test", True)
        else:
            assert admin.set_user_admin("test", True) == result


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
        "setUserActive",
        variables={"name": "test", "active": True},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.set_user_active("test", True)
        else:
            assert admin.set_user_active("test", True) == result


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
        "resetUserPassword",
        variables={"name": "test"},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.reset_user_password("test")
        else:
            assert admin.reset_user_password("test") == result


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
        "setRole",
        variables={"name": "test", "role": "UnamangedRole", "extraRoles": [], "append": True},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.set_role("test", "UnamangedRole", [], append=True)
        else:
            assert admin.set_role("test", "UnamangedRole", [], append=True) == result


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
        "addRoles",
        variables={"name": "test", "roles": ["ManagedRole"]},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.add_roles("test", ["ManagedRole"])
        else:
            assert admin.add_roles("test", ["ManagedRole"]) == result


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
        "removeRoles",
        variables={"name": "test", "roles": ["ManagedRole"], "fallback": "UnamanagedRole"},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.remove_roles("test", ["ManagedRole"], fallback="UnamanagedRole")
        else:
            assert admin.remove_roles("test", ["ManagedRole"], fallback="UnamanagedRole") == result
