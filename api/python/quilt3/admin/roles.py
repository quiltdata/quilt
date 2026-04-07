import typing as T

import pydantic

from .. import _graphql_client
from . import exceptions, types, util

_role_adapter = pydantic.TypeAdapter(types.AnnotatedRole)


def _parse_role(gql: _graphql_client.BaseModel) -> types.Role:
    return _role_adapter.validate_python(gql.model_dump())


def get(id: str) -> T.Optional[types.Role]:
    """
    Get a specific role from the registry. Return `None` if the role does not exist.

    Args:
        id: Role ID to get.
    """
    result = util.get_client().role_get(id=id)
    if result is None:
        return None
    return _parse_role(result)


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


def create_managed(name: str, policies: T.List[str]) -> types.ManagedRole:
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


def update_managed(id: str, name: str, policies: T.List[str]) -> types.ManagedRole:
    """
    Update a managed role in the registry.

    Args:
        id: Role ID.
        name: New role name.
        policies: Policy IDs to attach to the role.
    """
    result = util.get_client().role_update_managed(
        id=id,
        input=_graphql_client.ManagedRoleInput(name=name, policies=policies),
    )
    return _handle_role_mutation_result(result)


def update_unmanaged(id: str, name: str, arn: str) -> types.UnmanagedRole:
    """
    Update an unmanaged role in the registry.

    Args:
        id: Role ID.
        name: New role name.
        arn: Existing IAM role ARN.
    """
    result = util.get_client().role_update_unmanaged(
        id=id,
        input=_graphql_client.UnmanagedRoleInput(name=name, arn=arn),
    )
    return _handle_role_mutation_result(result)


def delete(id: str) -> None:
    """
    Delete a role from the registry.

    Args:
        id: Role ID.
    """
    result = util.get_client().role_delete(id=id)
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


def set_default(id: str) -> types.Role:
    """
    Set the default role in the registry.

    Args:
        id: Role ID.
    """
    result = util.get_client().role_set_default(id=id)
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
