import builtins

from .. import _graphql_client
from . import exceptions, types, util


def _get_by_id(id: str) -> types.Role | None:
    result = util.get_client().role_get(id=id)
    if result is None:
        return None
    return types._parse_role(result)


def _get_by_name(name: str) -> types.Role | None:
    return next((r for r in list() if r.name == name), None)


def get(id_or_name: str) -> types.Role | None:
    """
    Get a role by ID or name. Return `None` if the role does not exist.

    Args:
        id_or_name: Role ID or name.
    """
    return _get_by_id(id_or_name) or _get_by_name(id_or_name)


def _resolve_role(id_or_name: str) -> types.Role:
    """Resolve a role by ID or name, raising RoleNotFoundError if not found."""
    result = get(id_or_name)
    if result is not None:
        return result
    raise exceptions.RoleNotFoundError()


def get_default() -> types.Role | None:
    """
    Get the default role from the registry. Return `None` if no default role is set.
    """
    result = util.get_client().default_role_get()
    if result is None:
        return None
    return types._parse_role(result)


def list() -> builtins.list[types.Role]:
    """
    Get a list of all roles in the registry.
    """
    return [types._parse_role(role) for role in util.get_client().roles_list()]


def _signup_input(signup: types.RoleSignup | None) -> _graphql_client.RoleSignupInput | None:
    return None if signup is None else signup._to_gql()


def create_managed(
    name: str,
    policies: builtins.list[str] = (),
    *,
    default_bucket: str | None = None,
    signup: types.RoleSignup | None = None,
) -> types.ManagedRole:
    """
    Create a managed role in the registry.

    Args:
        name: Role name.
        policies: Policy IDs to attach to the role.
        default_bucket: Bucket the role's users land on after login.
        signup: Access-code signup page for the role.
    """
    result = util.get_client().role_create_managed(
        input=_graphql_client.ManagedRoleInput(
            name=name,
            policies=policies,
            default_bucket=default_bucket,
            signup=_signup_input(signup),
        )
    )
    return _handle_role_mutation_result(result)


def create_unmanaged(
    name: str,
    arn: str,
    *,
    default_bucket: str | None = None,
    signup: types.RoleSignup | None = None,
) -> types.UnmanagedRole:
    """
    Create an unmanaged role in the registry.

    Args:
        name: Role name.
        arn: Existing IAM role ARN.
        default_bucket: Bucket the role's users land on after login.
        signup: Access-code signup page for the role.
    """
    result = util.get_client().role_create_unmanaged(
        input=_graphql_client.UnmanagedRoleInput(
            name=name,
            arn=arn,
            default_bucket=default_bucket,
            signup=_signup_input(signup),
        )
    )
    return _handle_role_mutation_result(result)


def update_managed(
    id_or_name: str,
    *,
    name: str,
    policies: builtins.list[str],
    default_bucket: str | None = None,
    signup: types.RoleSignup | None = None,
) -> types.ManagedRole:
    """
    Update a managed role in the registry (full replacement).

    Args:
        id_or_name: Role ID or name.
        name: New role name.
        policies: Policy IDs to attach to the role.
        default_bucket: Bucket the role's users land on after login; `None` clears it.
        signup: Access-code signup page for the role; `None` removes it.
    """
    role = _resolve_role(id_or_name)
    result = util.get_client().role_update_managed(
        id=role.id,
        input=_graphql_client.ManagedRoleInput(
            name=name,
            policies=policies,
            default_bucket=default_bucket,
            signup=_signup_input(signup),
        ),
    )
    return _handle_role_mutation_result(result)


def update_unmanaged(
    id_or_name: str,
    *,
    name: str,
    arn: str,
    default_bucket: str | None = None,
    signup: types.RoleSignup | None = None,
) -> types.UnmanagedRole:
    """
    Update an unmanaged role in the registry (full replacement).

    Args:
        id_or_name: Role ID or name.
        name: New role name.
        arn: Existing IAM role ARN.
        default_bucket: Bucket the role's users land on after login; `None` clears it.
        signup: Access-code signup page for the role; `None` removes it.
    """
    role = _resolve_role(id_or_name)
    result = util.get_client().role_update_unmanaged(
        id=role.id,
        input=_graphql_client.UnmanagedRoleInput(
            name=name,
            arn=arn,
            default_bucket=default_bucket,
            signup=_signup_input(signup),
        ),
    )
    return _handle_role_mutation_result(result)


def patch_managed(
    id_or_name: str,
    *,
    name: str | None = None,
    policies: builtins.list[str] | None = None,
    default_bucket: str | None = None,
    signup: types.RoleSignup | None = None,
) -> types.ManagedRole:
    """
    Partially update a managed role — only specified fields are changed.
    Use `update_managed()` to clear `default_bucket` or remove `signup`.

    Args:
        id_or_name: Role ID or name.
        name: New role name (keeps current if not specified).
        policies: Policy IDs to attach (keeps current if not specified).
        default_bucket: Bucket the role's users land on after login (keeps current if not specified).
        signup: Access-code signup page for the role (keeps current if not specified).
    """
    current = _resolve_role(id_or_name)
    if not isinstance(current, types.ManagedRole):
        raise exceptions.RoleTypeMismatchError(current)
    result = util.get_client().role_update_managed(
        id=current.id,
        input=_graphql_client.ManagedRoleInput(
            name=name if name is not None else current.name,
            policies=policies if policies is not None else [p.id for p in current.policies],
            default_bucket=default_bucket if default_bucket is not None else current.default_bucket,
            signup=_signup_input(signup if signup is not None else current.signup),
        ),
    )
    return _handle_role_mutation_result(result)


def patch_unmanaged(
    id_or_name: str,
    *,
    name: str | None = None,
    arn: str | None = None,
    default_bucket: str | None = None,
    signup: types.RoleSignup | None = None,
) -> types.UnmanagedRole:
    """
    Partially update an unmanaged role — only specified fields are changed.
    Use `update_unmanaged()` to clear `default_bucket` or remove `signup`.

    Args:
        id_or_name: Role ID or name.
        name: New role name (keeps current if not specified).
        arn: New IAM role ARN (keeps current if not specified).
        default_bucket: Bucket the role's users land on after login (keeps current if not specified).
        signup: Access-code signup page for the role (keeps current if not specified).
    """
    current = _resolve_role(id_or_name)
    if not isinstance(current, types.UnmanagedRole):
        raise exceptions.RoleTypeMismatchError(current)
    result = util.get_client().role_update_unmanaged(
        id=current.id,
        input=_graphql_client.UnmanagedRoleInput(
            name=name if name is not None else current.name,
            arn=arn if arn is not None else current.arn,
            default_bucket=default_bucket if default_bucket is not None else current.default_bucket,
            signup=_signup_input(signup if signup is not None else current.signup),
        ),
    )
    return _handle_role_mutation_result(result)


def delete(id_or_name: str) -> None:
    """
    Delete a role from the registry.

    Args:
        id_or_name: Role ID or name.
    """
    role = _resolve_role(id_or_name)
    result = util.get_client().role_delete(id=role.id)
    typename = result.typename__
    if typename == "RoleDeleteSuccess":
        return None
    if typename == "RoleDoesNotExist":
        raise exceptions.RoleNotFoundError()
    if typename == "RoleNameReserved":
        raise exceptions.RoleNameReservedError(result)
    if typename == "RoleAssigned":
        raise exceptions.RoleAssignedError(result)
    if typename == "RoleOwnsDataProducts":
        raise exceptions.RoleOwnsDataProductsError(result)
    if typename == "RoleNameUsedBySsoConfig":
        raise exceptions.RoleSsoConfigConflictError(result)
    raise exceptions.Quilt3AdminError(result)


def set_default(id_or_name: str) -> types.Role:
    """
    Set the default role in the registry.

    Args:
        id_or_name: Role ID or name.
    """
    role = _resolve_role(id_or_name)
    result = util.get_client().role_set_default(id=role.id)
    typename = result.typename__
    if typename == "RoleSetDefaultSuccess":
        return types._parse_role(result.role)
    if typename == "RoleDoesNotExist":
        raise exceptions.RoleNotFoundError()
    if typename == "SsoConfigConflict":
        raise exceptions.RoleSsoConfigConflictError(result)
    raise exceptions.Quilt3AdminError(result)


def _handle_role_mutation_result(result):
    typename = result.typename__
    if typename in {"RoleCreateSuccess", "RoleUpdateSuccess"}:
        return types._parse_role(result.role)
    if typename == "RoleDoesNotExist":
        raise exceptions.RoleNotFoundError()
    if typename == "RoleNameReserved":
        raise exceptions.RoleNameReservedError(result)
    if typename == "RoleNameExists":
        raise exceptions.RoleNameExistsError(result)
    if typename == "RoleNameInvalid":
        raise exceptions.RoleNameInvalidError(result)
    if typename == "RoleHasTooManyPoliciesToAttach":
        raise exceptions.RoleTooManyPoliciesError(result)
    if typename == "RoleSignupPageConflict":
        raise exceptions.RoleSignupPageConflictError(result)
    if typename in {"RoleIsManaged", "RoleIsUnmanaged"}:
        raise exceptions.RoleTypeMismatchError(result)
    if typename == "RoleNameUsedBySsoConfig":
        raise exceptions.RoleSsoConfigConflictError(result)
    raise exceptions.Quilt3AdminError(result)
