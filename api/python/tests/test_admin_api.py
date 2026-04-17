import contextlib
import datetime
from unittest import mock

import pytest

from quilt3 import _graphql_client, admin

from .utils import as_dataclass_kwargs

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
    "policies": [
        {
            "id": "be8f3af1-8f5b-463a-89ff-373769e6d0d3",
            "title": "ManagedPolicy",
            "arn": "arn:aws:iam::000000000000:policy/ManagedPolicy",
            "managed": True,
            "permissions": [{"bucket": {"name": "example-bucket"}, "level": "READ"}],
        }
    ],
    "permissions": [{"bucket": {"name": "example-bucket"}, "level": "READ"}],
}
PERMISSION = {
    "bucket": {
        "name": "example-bucket",
    },
    "level": "READ",
}
EXPECTED_PERMISSION = admin.Permission(bucket="example-bucket", level=admin.BucketPermissionLevel.READ)
EXPECTED_POLICY_SUMMARY = admin.PolicySummary(
    id="be8f3af1-8f5b-463a-89ff-373769e6d0d3",
    title="ManagedPolicy",
    arn="arn:aws:iam::000000000000:policy/ManagedPolicy",
    managed=True,
    permissions=[EXPECTED_PERMISSION],
)
EXPECTED_MANAGED_ROLE = admin.ManagedRole(
    id="b1bab604-98fd-4b46-a20b-958cf2541c91",
    name="ManagedRole",
    arn="arn:aws:iam::000000000000:role/ManagedRole",
    policies=[EXPECTED_POLICY_SUMMARY],
    permissions=[EXPECTED_PERMISSION],
    typename__="ManagedRole",
)
EXPECTED_UNMANAGED_ROLE = admin.UnmanagedRole(
    id="d7d15bef-c482-4086-ae6b-d0372b6145d2",
    name="UnmanagedRole",
    arn="arn:aws:iam::000000000000:role/UnmanagedRole",
    typename__="UnmanagedRole",
)
POLICY = {
    "__typename": "Policy",
    "id": "be8f3af1-8f5b-463a-89ff-373769e6d0d3",
    "title": "ManagedPolicy",
    "arn": "arn:aws:iam::000000000000:policy/ManagedPolicy",
    "managed": True,
    "permissions": [PERMISSION],
    "roles": [MANAGED_ROLE],
}
UNMANAGED_POLICY = {
    **POLICY,
    "title": "UnmanagedPolicy",
    "arn": "arn:aws:iam::000000000000:policy/UnmanagedPolicy",
    "managed": False,
}
LAST_LOGIN_CONTEXT = {
    "__typename": "UserLastLoginContext",
    "ssoProvider": "okta",
    "idTokenPayload": {"sub": "test", "groups": ["Employees", "Everyone"]},
    "matchedMappingIndices": [0, 1],
    "assignedRoles": ["member", "visitor"],
    "activeRole": "member",
    "isAdmin": True,
    "loginAt": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
}
EXPECTED_LAST_LOGIN_CONTEXT = admin.UserLastLoginContext(
    sso_provider="okta",
    id_token_payload={"sub": "test", "groups": ["Employees", "Everyone"]},
    matched_mapping_indices=[0, 1],
    assigned_roles=["member", "visitor"],
    active_role="member",
    is_admin=True,
    login_at=datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
)
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
    "lastLoginContext": LAST_LOGIN_CONTEXT,
}
EXPECTED_USER = admin.User(
    name="test",
    email="test@example.com",
    date_joined=datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    last_login=datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    is_active=True,
    is_admin=False,
    is_sso_only=False,
    is_service=False,
    role=EXPECTED_UNMANAGED_ROLE,
    extra_roles=[EXPECTED_MANAGED_ROLE],
    last_login_context=EXPECTED_LAST_LOGIN_CONTEXT,
)
SSO_CONFIG = {
    "__typename": "SsoConfig",
    "text": "",
    "timestamp": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "uploader": USER,
}
EXPECTED_SSO_CONFIG = admin.SSOConfig(
    text="",
    timestamp=datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    uploader=EXPECTED_USER,
)
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

# API key operations don't return OperationError
API_KEY_MUTATION_ERRORS = (MUTATION_ERRORS[0],)
USER_MUTATION_ERRORS = (
    *MUTATION_ERRORS,
    (None, admin.UserNotFoundError),
)
ROLE_CREATE_ERRORS = (
    ({"__typename": "RoleNameReserved"}, admin.RoleNameReservedError),
    ({"__typename": "RoleNameExists"}, admin.RoleNameExistsError),
    ({"__typename": "RoleNameInvalid"}, admin.RoleNameInvalidError),
    ({"__typename": "RoleHasTooManyPoliciesToAttach"}, admin.RoleTooManyPoliciesError),
)
ROLE_UPDATE_ERRORS = (
    *ROLE_CREATE_ERRORS,
    ({"__typename": "RoleIsManaged"}, admin.RoleTypeMismatchError),
    ({"__typename": "RoleIsUnmanaged"}, admin.RoleTypeMismatchError),
    ({"__typename": "RoleNameUsedBySsoConfig"}, admin.RoleSsoConfigConflictError),
)
ROLE_DELETE_ERRORS = (
    ({"__typename": "RoleDoesNotExist"}, admin.RoleNotFoundError),
    ({"__typename": "RoleNameReserved"}, admin.RoleNameReservedError),
    ({"__typename": "RoleAssigned"}, admin.RoleAssignedError),
    ({"__typename": "RoleNameUsedBySsoConfig"}, admin.RoleSsoConfigConflictError),
)
ROLE_SET_DEFAULT_ERRORS = (
    ({"__typename": "RoleDoesNotExist"}, admin.RoleNotFoundError),
    ({"__typename": "SsoConfigConflict"}, admin.RoleSsoConfigConflictError),
)
POLICY_INVALID_INPUT_ERRORS = (
    (
        {
            "__typename": "InvalidInput",
            "errors": [
                {
                    "path": "id",
                    "message": "Specified policy does not exist",
                    "name": "PolicyDoesNotExist",
                    "context": None,
                }
            ],
        },
        admin.PolicyNotFoundError,
    ),
    (
        {
            "__typename": "InvalidInput",
            "errors": [
                {
                    "path": "input.title",
                    "message": "duplicate title",
                    "name": "PolicyTitleConflict",
                    "context": None,
                }
            ],
        },
        admin.PolicyTitleExistsError,
    ),
    (
        {
            "__typename": "InvalidInput",
            "errors": [
                {
                    "path": "input.arn",
                    "message": "duplicate arn",
                    "name": "PolicyArnConflict",
                    "context": None,
                }
            ],
        },
        admin.PolicyArnExistsError,
    ),
    (
        {
            "__typename": "InvalidInput",
            "errors": [
                {
                    "path": "input.roles",
                    "message": "Role can have at most 10 policies",
                    "name": "RoleHasTooManyPoliciesToAttach",
                    "context": {"max_policies": 10},
                }
            ],
        },
        admin.RoleTooManyPoliciesError,
    ),
    (
        {
            "__typename": "InvalidInput",
            "errors": [
                {
                    "path": "input.arn",
                    "message": "Policy ARN is invalid",
                    "name": "PolicyArnInvalid",
                    "context": None,
                }
            ],
        },
        admin.InvalidInputError,
    ),
)
POLICY_CREATE_UPDATE_ERRORS = (
    *POLICY_INVALID_INPUT_ERRORS,
    (
        {
            "__typename": "OperationError",
            "message": "Specified policy is assigned to a role and therefore cannot be deleted",
            "name": "PolicyAssigned",
            "context": {},
        },
        admin.OperationError,
    ),
)
POLICY_DELETE_ERRORS = (
    POLICY_INVALID_INPUT_ERRORS[0],
    POLICY_CREATE_UPDATE_ERRORS[-1],
)


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


@contextlib.contextmanager
def mock_client_multi(*calls):
    """Mock multiple sequential GraphQL calls. Each call is (data, operation_name, variables)."""
    responses = [c[0] for c in calls]
    with mock.patch("quilt3.session.get_registry_url", return_value="https://registry.example.com"):
        with mock.patch("quilt3._graphql_client.Client.execute", return_value=mock.sentinel.RESPONSE) as execute_mock:
            with mock.patch("quilt3._graphql_client.Client.get_data", side_effect=responses):
                yield

    assert execute_mock.call_count == len(calls)
    for i, (_, op_name, *rest) in enumerate(calls):
        variables = rest[0] if rest else {}
        execute_mock.assert_any_call(query=mock.ANY, operation_name=op_name, variables=variables)


def test_get_roles():
    with mock_client({"roles": [UNMANAGED_ROLE, MANAGED_ROLE]}, "rolesList"):
        assert admin.roles.list() == [
            EXPECTED_UNMANAGED_ROLE,
            EXPECTED_MANAGED_ROLE,
        ]


@pytest.mark.parametrize(
    "data,result",
    [
        (MANAGED_ROLE, EXPECTED_MANAGED_ROLE),
        (UNMANAGED_ROLE, EXPECTED_UNMANAGED_ROLE),
        (None, None),
    ],
)
def test_get_default_role(data, result):
    with mock_client({"default_role": data}, "defaultRoleGet"):
        assert admin.roles.get_default() == result


@pytest.mark.parametrize(
    "role_data,expected",
    [
        (MANAGED_ROLE, EXPECTED_MANAGED_ROLE),
        (UNMANAGED_ROLE, EXPECTED_UNMANAGED_ROLE),
    ],
)
def test_get_role_by_id(role_data, expected):
    with mock_client({"role": role_data}, "roleGet", variables={"id": role_data["id"]}):
        assert admin.roles.get(role_data["id"]) == expected


def test_get_role_by_name():
    with mock_client_multi(
        ({"role": None}, "roleGet", {"id": "ManagedRole"}),
        ({"roles": [MANAGED_ROLE]}, "rolesList"),
    ):
        assert admin.roles.get("ManagedRole") == EXPECTED_MANAGED_ROLE


def test_get_role_not_found():
    with mock_client_multi(
        ({"role": None}, "roleGet", {"id": "nonexistent"}),
        ({"roles": []}, "rolesList"),
    ):
        assert admin.roles.get("nonexistent") is None


@pytest.mark.parametrize(
    "data,result",
    [
        (
            {"__typename": "RoleCreateSuccess", "role": MANAGED_ROLE},
            EXPECTED_MANAGED_ROLE,
        ),
        *ROLE_CREATE_ERRORS,
    ],
)
def test_create_managed_role(data, result):
    with mock_client(
        {"role_create_managed": data},
        "roleCreateManaged",
        variables={"input": _graphql_client.ManagedRoleInput(name="ManagedRole", policies=[])},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.roles.create_managed("ManagedRole", [])
        else:
            assert admin.roles.create_managed("ManagedRole", []) == result


@pytest.mark.parametrize(
    "data,result",
    [
        (
            {"__typename": "RoleCreateSuccess", "role": UNMANAGED_ROLE},
            EXPECTED_UNMANAGED_ROLE,
        ),
        *ROLE_CREATE_ERRORS,
    ],
)
def test_create_unmanaged_role(data, result):
    with mock_client(
        {"role_create_unmanaged": data},
        "roleCreateUnmanaged",
        variables={
            "input": _graphql_client.UnmanagedRoleInput(
                name="UnmanagedRole",
                arn="arn:aws:iam::000000000000:role/UnmanagedRole",
            )
        },
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.roles.create_unmanaged("UnmanagedRole", "arn:aws:iam::000000000000:role/UnmanagedRole")
        else:
            assert (
                admin.roles.create_unmanaged("UnmanagedRole", "arn:aws:iam::000000000000:role/UnmanagedRole") == result
            )


@pytest.mark.parametrize(
    "data,result",
    [
        (
            {"__typename": "RoleUpdateSuccess", "role": MANAGED_ROLE},
            EXPECTED_MANAGED_ROLE,
        ),
        *ROLE_UPDATE_ERRORS,
    ],
)
def test_update_managed_role(data, result):
    with mock_client_multi(
        ({"role": MANAGED_ROLE}, "roleGet", {"id": MANAGED_ROLE["id"]}),
        (
            {"role_update_managed": data},
            "roleUpdateManaged",
            {
                "id": MANAGED_ROLE["id"],
                "input": _graphql_client.ManagedRoleInput(name="ManagedRole", policies=[]),
            },
        ),
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.roles.update_managed(MANAGED_ROLE["id"], name="ManagedRole", policies=[])
        else:
            assert admin.roles.update_managed(MANAGED_ROLE["id"], name="ManagedRole", policies=[]) == result


@pytest.mark.parametrize(
    "data,result",
    [
        (
            {"__typename": "RoleUpdateSuccess", "role": UNMANAGED_ROLE},
            EXPECTED_UNMANAGED_ROLE,
        ),
        *ROLE_UPDATE_ERRORS,
    ],
)
def test_update_unmanaged_role(data, result):
    with mock_client_multi(
        ({"role": UNMANAGED_ROLE}, "roleGet", {"id": UNMANAGED_ROLE["id"]}),
        (
            {"role_update_unmanaged": data},
            "roleUpdateUnmanaged",
            {
                "id": UNMANAGED_ROLE["id"],
                "input": _graphql_client.UnmanagedRoleInput(
                    name="UnmanagedRole",
                    arn="arn:aws:iam::000000000000:role/UnmanagedRole",
                ),
            },
        ),
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.roles.update_unmanaged(
                    UNMANAGED_ROLE["id"],
                    name="UnmanagedRole",
                    arn="arn:aws:iam::000000000000:role/UnmanagedRole",
                )
        else:
            assert (
                admin.roles.update_unmanaged(
                    UNMANAGED_ROLE["id"],
                    name="UnmanagedRole",
                    arn="arn:aws:iam::000000000000:role/UnmanagedRole",
                )
                == result
            )


def test_delete_role_success():
    with mock_client_multi(
        ({"role": MANAGED_ROLE}, "roleGet", {"id": MANAGED_ROLE["id"]}),
        ({"role_delete": {"__typename": "RoleDeleteSuccess"}}, "roleDelete", {"id": MANAGED_ROLE["id"]}),
    ):
        assert admin.roles.delete(MANAGED_ROLE["id"]) is None


@pytest.mark.parametrize("data,error_type", ROLE_DELETE_ERRORS)
def test_delete_role_errors(data, error_type):
    with mock_client_multi(
        ({"role": MANAGED_ROLE}, "roleGet", {"id": MANAGED_ROLE["id"]}),
        ({"role_delete": data}, "roleDelete", {"id": MANAGED_ROLE["id"]}),
    ):
        with pytest.raises(error_type):
            admin.roles.delete(MANAGED_ROLE["id"])


@pytest.mark.parametrize(
    "data,result",
    [
        (
            {"__typename": "RoleSetDefaultSuccess", "role": MANAGED_ROLE},
            EXPECTED_MANAGED_ROLE,
        ),
        *ROLE_SET_DEFAULT_ERRORS,
    ],
)
def test_set_default_role(data, result):
    with mock_client_multi(
        ({"role": MANAGED_ROLE}, "roleGet", {"id": MANAGED_ROLE["id"]}),
        ({"role_set_default": data}, "roleSetDefault", {"id": MANAGED_ROLE["id"]}),
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.roles.set_default(MANAGED_ROLE["id"])
        else:
            assert admin.roles.set_default(MANAGED_ROLE["id"]) == result


def test_patch_managed_role():
    updated = {**MANAGED_ROLE, "name": "NewName"}
    with mock_client_multi(
        ({"role": MANAGED_ROLE}, "roleGet", {"id": MANAGED_ROLE["id"]}),
        (
            {"role_update_managed": {"__typename": "RoleUpdateSuccess", "role": updated}},
            "roleUpdateManaged",
            {
                "id": MANAGED_ROLE["id"],
                "input": _graphql_client.ManagedRoleInput(
                    name="NewName",
                    policies=[MANAGED_ROLE["policies"][0]["id"]],
                ),
            },
        ),
    ):
        result = admin.roles.patch_managed(MANAGED_ROLE["id"], name="NewName")
        assert result.name == "NewName"


def test_patch_managed_role_type_mismatch():
    with mock_client({"role": UNMANAGED_ROLE}, "roleGet", variables={"id": UNMANAGED_ROLE["id"]}):
        with pytest.raises(admin.RoleTypeMismatchError):
            admin.roles.patch_managed(UNMANAGED_ROLE["id"], name="NewName")


def test_patch_unmanaged_role():
    updated = {**UNMANAGED_ROLE, "name": "NewName"}
    with mock_client_multi(
        ({"role": UNMANAGED_ROLE}, "roleGet", {"id": UNMANAGED_ROLE["id"]}),
        (
            {"role_update_unmanaged": {"__typename": "RoleUpdateSuccess", "role": updated}},
            "roleUpdateUnmanaged",
            {
                "id": UNMANAGED_ROLE["id"],
                "input": _graphql_client.UnmanagedRoleInput(
                    name="NewName",
                    arn=UNMANAGED_ROLE["arn"],
                ),
            },
        ),
    ):
        result = admin.roles.patch_unmanaged(UNMANAGED_ROLE["id"], name="NewName")
        assert result.name == "NewName"


EXPECTED_POLICY = admin.Policy(
    id=POLICY["id"],
    title=POLICY["title"],
    arn=POLICY["arn"],
    managed=POLICY["managed"],
    permissions=[EXPECTED_PERMISSION],
    roles=[EXPECTED_MANAGED_ROLE],
)
EXPECTED_UNMANAGED_POLICY = admin.Policy(
    id=UNMANAGED_POLICY["id"],
    title=UNMANAGED_POLICY["title"],
    arn=UNMANAGED_POLICY["arn"],
    managed=UNMANAGED_POLICY["managed"],
    permissions=[EXPECTED_PERMISSION],
    roles=[EXPECTED_MANAGED_ROLE],
)


def test_get_policy_by_id():
    with mock_client({"policy": POLICY}, "policyGet", variables={"id": POLICY["id"]}):
        assert admin.policies.get(POLICY["id"]) == EXPECTED_POLICY


def test_get_policy_by_title():
    with mock_client_multi(
        ({"policy": None}, "policyGet", {"id": "ManagedPolicy"}),
        ({"policies": [POLICY]}, "policiesList"),
    ):
        assert admin.policies.get("ManagedPolicy") == EXPECTED_POLICY


def test_get_policy_not_found():
    with mock_client_multi(
        ({"policy": None}, "policyGet", {"id": "nonexistent"}),
        ({"policies": []}, "policiesList"),
    ):
        assert admin.policies.get("nonexistent") is None


def test_list_policies():
    with mock_client({"policies": [POLICY]}, "policiesList"):
        assert admin.policies.list() == [EXPECTED_POLICY]


@pytest.mark.parametrize(
    "data,result",
    [
        (POLICY, EXPECTED_POLICY),
        *POLICY_CREATE_UPDATE_ERRORS,
    ],
)
def test_create_managed_policy(data, result):
    permission = admin.Permission(bucket="example-bucket", level=admin.BucketPermissionLevel.READ)
    with mock_client(
        {"policy_create_managed": data},
        "policyCreateManaged",
        variables={
            "input": _graphql_client.ManagedPolicyInput(
                title="ManagedPolicy",
                permissions=[_graphql_client.PermissionInput(bucket="example-bucket", level="READ")],
                roles=[MANAGED_ROLE["id"]],
            )
        },
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.policies.create_managed("ManagedPolicy", permissions=[permission], roles=[MANAGED_ROLE["id"]])
        else:
            assert (
                admin.policies.create_managed("ManagedPolicy", permissions=[permission], roles=[MANAGED_ROLE["id"]])
                == result
            )


@pytest.mark.parametrize(
    "data,result",
    [
        (UNMANAGED_POLICY, EXPECTED_UNMANAGED_POLICY),
        *POLICY_CREATE_UPDATE_ERRORS,
    ],
)
def test_create_unmanaged_policy(data, result):
    with mock_client(
        {"policy_create_unmanaged": data},
        "policyCreateUnmanaged",
        variables={
            "input": _graphql_client.UnmanagedPolicyInput(
                title="UnmanagedPolicy",
                arn="arn:aws:iam::000000000000:policy/UnmanagedPolicy",
                roles=[MANAGED_ROLE["id"]],
            )
        },
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.policies.create_unmanaged(
                    "UnmanagedPolicy",
                    arn="arn:aws:iam::000000000000:policy/UnmanagedPolicy",
                    roles=[MANAGED_ROLE["id"]],
                )
        else:
            assert (
                admin.policies.create_unmanaged(
                    "UnmanagedPolicy",
                    arn="arn:aws:iam::000000000000:policy/UnmanagedPolicy",
                    roles=[MANAGED_ROLE["id"]],
                )
                == result
            )


@pytest.mark.parametrize(
    "data,result",
    [
        (POLICY, EXPECTED_POLICY),
        *POLICY_CREATE_UPDATE_ERRORS,
    ],
)
def test_update_managed_policy(data, result):
    permission = admin.Permission(bucket="example-bucket", level=admin.BucketPermissionLevel.READ)
    with mock_client_multi(
        ({"policy": POLICY}, "policyGet", {"id": POLICY["id"]}),
        (
            {"policy_update_managed": data},
            "policyUpdateManaged",
            {
                "id": POLICY["id"],
                "input": _graphql_client.ManagedPolicyInput(
                    title="ManagedPolicy",
                    permissions=[_graphql_client.PermissionInput(bucket="example-bucket", level="READ")],
                    roles=[MANAGED_ROLE["id"]],
                ),
            },
        ),
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.policies.update_managed(
                    POLICY["id"], title="ManagedPolicy", permissions=[permission], roles=[MANAGED_ROLE["id"]]
                )
        else:
            assert (
                admin.policies.update_managed(
                    POLICY["id"], title="ManagedPolicy", permissions=[permission], roles=[MANAGED_ROLE["id"]]
                )
                == result
            )


@pytest.mark.parametrize(
    "data,result",
    [
        (UNMANAGED_POLICY, EXPECTED_UNMANAGED_POLICY),
        *POLICY_CREATE_UPDATE_ERRORS,
    ],
)
def test_update_unmanaged_policy(data, result):
    with mock_client_multi(
        ({"policy": POLICY}, "policyGet", {"id": POLICY["id"]}),
        (
            {"policy_update_unmanaged": data},
            "policyUpdateUnmanaged",
            {
                "id": POLICY["id"],
                "input": _graphql_client.UnmanagedPolicyInput(
                    title="UnmanagedPolicy",
                    arn="arn:aws:iam::000000000000:policy/UnmanagedPolicy",
                    roles=[MANAGED_ROLE["id"]],
                ),
            },
        ),
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.policies.update_unmanaged(
                    POLICY["id"],
                    title="UnmanagedPolicy",
                    arn="arn:aws:iam::000000000000:policy/UnmanagedPolicy",
                    roles=[MANAGED_ROLE["id"]],
                )
        else:
            assert (
                admin.policies.update_unmanaged(
                    POLICY["id"],
                    title="UnmanagedPolicy",
                    arn="arn:aws:iam::000000000000:policy/UnmanagedPolicy",
                    roles=[MANAGED_ROLE["id"]],
                )
                == result
            )


def test_delete_policy_success():
    with mock_client_multi(
        ({"policy": POLICY}, "policyGet", {"id": POLICY["id"]}),
        ({"policy_delete": {"__typename": "Ok"}}, "policyDelete", {"id": POLICY["id"]}),
    ):
        assert admin.policies.delete(POLICY["id"]) is None


@pytest.mark.parametrize("data,error_type", POLICY_DELETE_ERRORS)
def test_delete_policy_errors(data, error_type):
    with mock_client_multi(
        ({"policy": POLICY}, "policyGet", {"id": POLICY["id"]}),
        ({"policy_delete": data}, "policyDelete", {"id": POLICY["id"]}),
    ):
        with pytest.raises(error_type):
            admin.policies.delete(POLICY["id"])


def test_patch_managed_policy():
    updated_policy = {**POLICY, "title": "NewTitle"}
    with mock_client_multi(
        ({"policy": POLICY}, "policyGet", {"id": POLICY["id"]}),
        (
            {"policy_update_managed": updated_policy},
            "policyUpdateManaged",
            {
                "id": POLICY["id"],
                "input": _graphql_client.ManagedPolicyInput(
                    title="NewTitle",
                    permissions=[_graphql_client.PermissionInput(bucket="example-bucket", level="READ")],
                    roles=[MANAGED_ROLE["id"]],
                ),
            },
        ),
    ):
        result = admin.policies.patch_managed(POLICY["id"], title="NewTitle")
        assert result.title == "NewTitle"


def test_patch_managed_policy_type_mismatch():
    with mock_client({"policy": UNMANAGED_POLICY}, "policyGet", variables={"id": UNMANAGED_POLICY["id"]}):
        with pytest.raises(admin.Quilt3AdminError, match="Cannot patch_managed"):
            admin.policies.patch_managed(UNMANAGED_POLICY["id"], title="NewTitle")


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, EXPECTED_USER),
        (None, None),
    ],
)
def test_get_user(data, result):
    with mock_client(_make_nested_dict("admin.user.get", data), "usersGet", variables={"name": "test"}):
        assert admin.users.get("test") == result


def test_get_users():
    with mock_client(_make_nested_dict("admin.user.list", [USER]), "usersList"):
        assert admin.users.list() == [EXPECTED_USER]


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, EXPECTED_USER),
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
        (USER, EXPECTED_USER),
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
        (USER, EXPECTED_USER),
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
        (USER, EXPECTED_USER),
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
        (USER, EXPECTED_USER),
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
        variables={"name": "test", "role": "UnmanagedRole", "extraRoles": [], "append": True},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.users.set_role("test", "UnmanagedRole", [], append=True)
        else:
            assert admin.users.set_role("test", "UnmanagedRole", [], append=True) == result


@pytest.mark.parametrize(
    "data,result",
    [
        (USER, EXPECTED_USER),
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
        (USER, EXPECTED_USER),
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
        variables={"name": "test", "roles": ["ManagedRole"], "fallback": "UnmanagedRole"},
    ):
        if isinstance(result, type) and issubclass(result, Exception):
            with pytest.raises(result):
                admin.users.remove_roles("test", ["ManagedRole"], fallback="UnmanagedRole")
        else:
            assert admin.users.remove_roles("test", ["ManagedRole"], fallback="UnmanagedRole") == result


@pytest.mark.parametrize(
    "data,result",
    [
        (SSO_CONFIG, EXPECTED_SSO_CONFIG),
        (None, None),
    ],
)
def test_sso_config_get(data, result):
    with mock_client(_make_nested_dict("admin.sso_config", data), "ssoConfigGet"):
        assert admin.sso_config.get() == result


@pytest.mark.parametrize(
    "data,result",
    [
        (SSO_CONFIG, EXPECTED_SSO_CONFIG),
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
        (BUCKET_CONFIG, admin.Bucket(**as_dataclass_kwargs(BUCKET_CONFIG))),
        (None, None),
    ],
)
def test_bucket_get(data, result):
    with mock_client({"bucket_config": data}, "bucketGet", variables={"name": "test-bucket"}):
        assert admin.buckets.get("test-bucket") == result


def test_bucket_list():
    with mock_client({"bucket_configs": [BUCKET_CONFIG]}, "bucketsList"):
        assert admin.buckets.list() == [admin.Bucket(**as_dataclass_kwargs(BUCKET_CONFIG))]


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
        assert result == admin.Bucket(**as_dataclass_kwargs(BUCKET_CONFIG))


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
        assert result == admin.Bucket(**as_dataclass_kwargs(BUCKET_CONFIG))


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


API_KEY = {
    "id": "key-123",
    "name": "test-key",
    "fingerprint": "qk_abc...xyz",
    "createdAt": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "expiresAt": datetime.datetime(2024, 9, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "lastUsedAt": None,
    "status": "ACTIVE",
    "userEmail": "user@example.com",
}


def test_api_keys_list():
    with mock_client(
        _make_nested_dict("admin.api_keys.list", [API_KEY]),
        "adminApiKeysList",
        variables={"email": None, "name": None, "fingerprint": None, "status": None},
    ):
        result = admin.api_keys.list()
        assert len(result) == 1
        assert result[0] == admin.APIKey(**as_dataclass_kwargs(API_KEY))


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
        result = admin.api_keys.list(email="user@example.com", key_name="test", status="ACTIVE")
        assert len(result) == 1


@pytest.mark.parametrize(
    "data,result",
    [
        (API_KEY, admin.APIKey(**as_dataclass_kwargs(API_KEY))),
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


@pytest.mark.parametrize("data,error_type", API_KEY_MUTATION_ERRORS)
def test_api_keys_revoke_errors(data, error_type):
    with mock_client(
        _make_nested_dict("admin.api_keys.revoke", data),
        "adminApiKeyRevoke",
        variables={"id": "key-123"},
    ):
        with pytest.raises(error_type):
            admin.api_keys.revoke("key-123")
