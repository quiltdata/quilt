import typing as T

import pydantic

from .. import _graphql_client
from . import exceptions, types, util

_role_adapter = pydantic.TypeAdapter(types.AnnotatedRole)


def _parse_role(gql: _graphql_client.BaseModel) -> types.Role:
    return _role_adapter.validate_python(gql.model_dump())


def _get_by_id(id: str) -> T.Optional[types.Role]:
    result = util.get_client().role_get(id=id)
    if result is None:
        return None
    return _parse_role(result)


def _get_by_name(name: str) -> T.Optional[types.Role]:
    return next((r for r in list() if r.name == name), None)


def get(id_or_name: str) -> T.Optional[types.Role]:
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


def get_default() -> T.Optional[types.Role]:
    """
    Get the default role from the registry. Return `None` if no default role is set.
    """
    result = util.get_client().default_role_get()
    if result is None:
        return None
    return _parse_role(result)


def list() -> T.List[types.Role]:
    """
    Get a list of all roles in the registry.
    """
    return [_parse_role(role) for role in util.get_client().roles_list()]


def create_managed(name: str, policies: T.List[str] = ()) -> types.ManagedRole:
    """
    Create a managed role in the registry.

    Args:
        name: Role name.
        policies: Policy IDs to attach to the role.
    """
    result = util.get_client().role_create_managed(
        input=_graphql_client.ManagedRoleInput(name=name, policies=policies)
    )
    return _handle_role_mutation_result(result)


def create_unmanaged(name: str, arn: str) -> types.UnmanagedRole:
    """
    Create an unmanaged role in the registry.

    Args:
        name: Role name.
        arn: Existing IAM role ARN.
    """
    result = util.get_client().role_create_unmanaged(input=_graphql_client.UnmanagedRoleInput(name=name, arn=arn))
    return _handle_role_mutation_result(result)


def update_managed(id_or_name: str, *, name: str, policies: T.List[str]) -> types.ManagedRole:
    """
    Update a managed role in the registry (full replacement).

    Args:
        id_or_name: Role ID or name.
        name: New role name.
        policies: Policy IDs to attach to the role.
    """
    role = _resolve_role(id_or_name)
    result = util.get_client().role_update_managed(
        id=role.id,
        input=_graphql_client.ManagedRoleInput(name=name, policies=policies),
    )
    return _handle_role_mutation_result(result)


def update_unmanaged(id_or_name: str, *, name: str, arn: str) -> types.UnmanagedRole:
    """
    Update an unmanaged role in the registry (full replacement).

    Args:
        id_or_name: Role ID or name.
        name: New role name.
        arn: Existing IAM role ARN.
    """
    role = _resolve_role(id_or_name)
    result = util.get_client().role_update_unmanaged(
        id=role.id,
        input=_graphql_client.UnmanagedRoleInput(name=name, arn=arn),
    )
    return _handle_role_mutation_result(result)


def patch_managed(
    id_or_name: str, *, name: T.Optional[str] = None, policies: T.Optional[T.List[str]] = None
) -> types.ManagedRole:
    """
    Partially update a managed role — only specified fields are changed.

    Args:
        id_or_name: Role ID or name.
        name: New role name (keeps current if not specified).
        policies: Policy IDs to attach (keeps current if not specified).
    """
    current = _resolve_role(id_or_name)
    if not isinstance(current, types.ManagedRole):
        raise exceptions.RoleTypeMismatchError(current)
    result = util.get_client().role_update_managed(
        id=current.id,
        input=_graphql_client.ManagedRoleInput(
            name=name if name is not None else current.name,
            policies=policies if policies is not None else [p.id for p in current.policies],
        ),
    )
    return _handle_role_mutation_result(result)


def patch_unmanaged(
    id_or_name: str, *, name: T.Optional[str] = None, arn: T.Optional[str] = None
) -> types.UnmanagedRole:
    """
    Partially update an unmanaged role — only specified fields are changed.

    Args:
        id_or_name: Role ID or name.
        name: New role name (keeps current if not specified).
        arn: New IAM role ARN (keeps current if not specified).
    """
    current = _resolve_role(id_or_name)
    if not isinstance(current, types.UnmanagedRole):
        raise exceptions.RoleTypeMismatchError(current)
    result = util.get_client().role_update_unmanaged(
        id=current.id,
        input=_graphql_client.UnmanagedRoleInput(
            name=name if name is not None else current.name,
            arn=arn if arn is not None else current.arn,
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
        return _parse_role(result.role)
    if typename == "RoleDoesNotExist":
        raise exceptions.RoleNotFoundError()
    if typename == "SsoConfigConflict":
        raise exceptions.RoleSsoConfigConflictError(result)
    raise exceptions.Quilt3AdminError(result)


def _handle_role_mutation_result(result):
    typename = result.typename__
    if typename in {"RoleCreateSuccess", "RoleUpdateSuccess"}:
        return _parse_role(result.role)
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
    if typename in {"RoleIsManaged", "RoleIsUnmanaged"}:
        raise exceptions.RoleTypeMismatchError(result)
    if typename == "RoleNameUsedBySsoConfig":
        raise exceptions.RoleSsoConfigConflictError(result)
    raise exceptions.Quilt3AdminError(result)
