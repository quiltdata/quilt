import contextlib
import datetime
from unittest import mock

import pytest

from quilt3 import _graphql_client, admin

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
            else [_as_dataclass_kwargs(x) if isinstance(x, dict) else x for x in v]
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
        with mock.patch("quilt3._graphql_client.Client.execute", return_value=mock.sentinel.RESPONSE) as execute_mock:
            with mock.patch("quilt3._graphql_client.Client.get_data", return_value=data) as get_data_mock:
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


BUCKET_CONFIG = {
    "name": "test-bucket",
    "title": "Test Bucket",
    "iconUrl": None,
    "description": "A test bucket",
    "overviewUrl": None,
    "tags": ["test"],
    "relevanceScore": 0,
    "lastIndexed": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "snsNotificationArn": None,
    "scannerParallelShardsDepth": None,
    "skipMetaDataIndexing": None,
    "fileExtensionsToIndex": None,
    "indexContentBytes": None,
    "prefixes": [""],
}
BUCKET_ADD_ERRORS = (
    ({"__typename": "BucketAlreadyAdded"}, admin.Quilt3AdminError, "Bucket already added"),
    ({"__typename": "BucketDoesNotExist"}, admin.Quilt3AdminError, "Bucket does not exist in S3"),
    (
        {"__typename": "InsufficientPermissions", "message": "Permission denied for prefix"},
        admin.Quilt3AdminError,
        "Permission denied for prefix",
    ),
    ({"__typename": "SnsInvalid"}, admin.Quilt3AdminError, "Invalid SNS notification ARN"),
    ({"__typename": "NotificationConfigurationError"}, admin.Quilt3AdminError, "Notification configuration error"),
    ({"__typename": "NotificationTopicNotFound"}, admin.Quilt3AdminError, "Notification topic not found"),
    ({"__typename": "BucketFileExtensionsToIndexInvalid"}, admin.Quilt3AdminError, "Invalid file extensions to index"),
    ({"__typename": "BucketIndexContentBytesInvalid"}, admin.Quilt3AdminError, "Invalid index content bytes"),
    ({"__typename": "SubscriptionInvalid"}, admin.Quilt3AdminError, "Invalid subscription"),
)
BUCKET_UPDATE_ERRORS = (
    ({"__typename": "BucketNotFound"}, admin.BucketNotFoundError, None),
    (
        {"__typename": "InsufficientPermissions", "message": "Permission denied for prefix"},
        admin.Quilt3AdminError,
        "Permission denied for prefix",
    ),
    ({"__typename": "SnsInvalid"}, admin.Quilt3AdminError, "Invalid SNS notification ARN"),
    ({"__typename": "NotificationConfigurationError"}, admin.Quilt3AdminError, "Notification configuration error"),
    ({"__typename": "NotificationTopicNotFound"}, admin.Quilt3AdminError, "Notification topic not found"),
    ({"__typename": "BucketFileExtensionsToIndexInvalid"}, admin.Quilt3AdminError, "Invalid file extensions to index"),
    ({"__typename": "BucketIndexContentBytesInvalid"}, admin.Quilt3AdminError, "Invalid index content bytes"),
)
BUCKET_REMOVE_ERRORS = (
    ({"__typename": "BucketNotFound"}, admin.BucketNotFoundError, None),
    (
        {"__typename": "IndexingInProgress"},
        admin.Quilt3AdminError,
        "Cannot remove bucket while indexing is in progress",
    ),
)


@pytest.mark.parametrize(
    "data,result",
    [
        (BUCKET_CONFIG, admin.Bucket(**_as_dataclass_kwargs(BUCKET_CONFIG))),
        (None, None),
    ],
)
def test_bucket_get(data, result):
    with mock_client({"bucket_config": data}, "bucketGet", variables={"name": "test-bucket"}):
        assert admin.buckets.get("test-bucket") == result


def test_bucket_list():
    with mock_client({"bucket_configs": [BUCKET_CONFIG]}, "bucketsList"):
        assert admin.buckets.list() == [admin.Bucket(**_as_dataclass_kwargs(BUCKET_CONFIG))]


def test_bucket_add_success():
    with mock_client(
        {
            "bucket_add": {
                "__typename": "BucketAddSuccess",
                "bucketConfig": BUCKET_CONFIG,
            }
        },
        "bucketAdd",
        variables={
            "input": _graphql_client.BucketAddInput(
                name="test-bucket",
                title="Test Bucket",
            )
        },
    ):
        result = admin.buckets.add("test-bucket", "Test Bucket")
        assert result == admin.Bucket(**_as_dataclass_kwargs(BUCKET_CONFIG))


@pytest.mark.parametrize("data,error_type,error_msg", BUCKET_ADD_ERRORS)
def test_bucket_add_errors(data, error_type, error_msg):
    with mock_client(
        {"bucket_add": data},
        "bucketAdd",
        variables={
            "input": _graphql_client.BucketAddInput(
                name="test-bucket",
                title="Test Bucket",
            )
        },
    ):
        with pytest.raises(error_type) as exc_info:
            admin.buckets.add("test-bucket", "Test Bucket")
        if error_msg:
            assert str(exc_info.value) == error_msg


def test_bucket_update_success():
    with mock_client(
        {
            "bucket_update": {
                "__typename": "BucketUpdateSuccess",
                "bucketConfig": BUCKET_CONFIG,
            }
        },
        "bucketUpdate",
        variables={
            "name": "test-bucket",
            "input": _graphql_client.BucketUpdateInput(
                title="Test Bucket",
            ),
        },
    ):
        result = admin.buckets.update("test-bucket", "Test Bucket")
        assert result == admin.Bucket(**_as_dataclass_kwargs(BUCKET_CONFIG))


@pytest.mark.parametrize("data,error_type,error_msg", BUCKET_UPDATE_ERRORS)
def test_bucket_update_errors(data, error_type, error_msg):
    with mock_client(
        {"bucket_update": data},
        "bucketUpdate",
        variables={
            "name": "test-bucket",
            "input": _graphql_client.BucketUpdateInput(
                title="Test Bucket",
            ),
        },
    ):
        with pytest.raises(error_type) as exc_info:
            admin.buckets.update("test-bucket", "Test Bucket")
        if error_msg:
            assert str(exc_info.value) == error_msg


def test_bucket_remove_success():
    with mock_client(
        {"bucket_remove": {"__typename": "BucketRemoveSuccess"}},
        "bucketRemove",
        variables={"name": "test-bucket"},
    ):
        assert admin.buckets.remove("test-bucket") is None


@pytest.mark.parametrize("data,error_type,error_msg", BUCKET_REMOVE_ERRORS)
def test_bucket_remove_errors(data, error_type, error_msg):
    with mock_client(
        {"bucket_remove": data},
        "bucketRemove",
        variables={"name": "test-bucket"},
    ):
        with pytest.raises(error_type) as exc_info:
            admin.buckets.remove("test-bucket")
        if error_msg:
            assert str(exc_info.value) == error_msg


# API Keys tests

API_KEY = {
    "id": "key-123",
    "name": "test-key",
    "fingerprint": "qk_abc...xyz",
    "createdAt": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "expiresAt": datetime.datetime(2024, 9, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "lastUsedAt": None,
    "createdByEmail": "admin@example.com",
    "status": "ACTIVE",
}


def test_api_keys_list():
    with mock_client(
        _make_nested_dict("admin.api_keys.list", [API_KEY]),
        "adminApiKeysList",
        variables={"email": None, "name": None, "fingerprint": None, "status": None},
    ):
        result = admin.api_keys.list()
        assert len(result) == 1
        assert result[0] == admin.APIKey(**_as_dataclass_kwargs(API_KEY))


def test_api_keys_list_with_filters():
    with mock_client(
        _make_nested_dict("admin.api_keys.list", [API_KEY]),
        "adminApiKeysList",
        variables={
            "email": "user@example.com",
            "name": "test",
            "fingerprint": None,
            "status": _graphql_client.APIKeyStatus.ACTIVE,
        },
    ):
        result = admin.api_keys.list(email="user@example.com", name="test", status="ACTIVE")
        assert len(result) == 1


@pytest.mark.parametrize(
    "data,result",
    [
        (API_KEY, admin.APIKey(**_as_dataclass_kwargs(API_KEY))),
        (None, None),
    ],
)
def test_api_keys_get(data, result):
    with mock_client(
        _make_nested_dict("admin.api_keys.get", data),
        "adminApiKeyGet",
        variables={"id": "key-123"},
    ):
        assert admin.api_keys.get("key-123") == result


def test_api_keys_revoke_success():
    with mock_client(
        _make_nested_dict("admin.api_keys.revoke", {"__typename": "Ok"}),
        "adminApiKeyRevoke",
        variables={"id": "key-123"},
    ):
        assert admin.api_keys.revoke("key-123") is None


@pytest.mark.parametrize("data,error_type", MUTATION_ERRORS)
def test_api_keys_revoke_errors(data, error_type):
    with mock_client(
        _make_nested_dict("admin.api_keys.revoke", data),
        "adminApiKeyRevoke",
        variables={"id": "key-123"},
    ):
        with pytest.raises(error_type):
            admin.api_keys.revoke("key-123")


def test_api_keys_create_for_user_success():
    with mock_client(
        _make_nested_dict(
            "admin.api_keys.create_for_user",
            {
                "__typename": "APIKeyCreated",
                "apiKey": API_KEY,
                "secret": "qk_secret_token_here",
            },
        ),
        "adminApiKeyCreateForUser",
        variables={
            "email": "user@example.com",
            "input": _graphql_client.APIKeyCreateInput(name="new-key", expires_in_days=90),
        },
    ):
        result = admin.api_keys.create_for_user("user@example.com", "new-key", expires_in_days=90)
        assert result.secret == "qk_secret_token_here"
        assert result.api_key == admin.APIKey(**_as_dataclass_kwargs(API_KEY))


@pytest.mark.parametrize("data,error_type", MUTATION_ERRORS)
def test_api_keys_create_for_user_errors(data, error_type):
    with mock_client(
        _make_nested_dict("admin.api_keys.create_for_user", data),
        "adminApiKeyCreateForUser",
        variables={
            "email": "user@example.com",
            "input": _graphql_client.APIKeyCreateInput(name="new-key", expires_in_days=90),
        },
    ):
        with pytest.raises(error_type):
            admin.api_keys.create_for_user("user@example.com", "new-key", expires_in_days=90)
