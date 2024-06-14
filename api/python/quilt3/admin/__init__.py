"""
APIs for Quilt administrators. 'Registry' refers to Quilt stack backend services, including identity management.
"""
# This wraps code generated by aridne-codegen to provide a more user-friendly API.
from datetime import datetime
from typing import Annotated, Any, List, Literal, Optional, Union

import pydantic

from . import _graphql_client


@pydantic.dataclasses.dataclass
class ManagedRole:
    id: str
    name: str
    arn: str
    typename__: Literal["ManagedRole"]



@pydantic.dataclasses.dataclass
class UnmanagedRole:
    id: str
    name: str
    arn: str
    typename__: Literal["UnmanagedRole"]


Role = Union[ManagedRole, UnmanagedRole]
AnnotatedRole = Annotated[Role, pydantic.Field(discriminator="typename__")]
role_adapter = pydantic.TypeAdapter(AnnotatedRole)


@pydantic.dataclasses.dataclass
class User:
    name: str
    email: str
    date_joined: datetime
    last_login: datetime
    is_active: bool
    is_admin: bool
    is_sso_only: bool
    is_service: bool
    role: Optional[AnnotatedRole]
    extra_roles: List[AnnotatedRole]


class Quilt3AdminError(Exception):
    def __init__(self, details):
        super().__init__(details)
        self.details = details


class UserNotFoundError(Quilt3AdminError):
    def __init__(self):
        super().__init__(None)


def _handle_errors(result: _graphql_client.BaseModel) -> Any:
    if isinstance(result, (_graphql_client.InvalidInputSelection, _graphql_client.OperationErrorSelection)):
        raise Quilt3AdminError(result)
    return result


def _get_client():
    return _graphql_client.Client()


def get_user(name: str) -> Optional[User]:
    """
    Get a specific user from the registry. Return `None` if the user does not exist.

    Args:
        name: Username of user to get.
    """
    result = _get_client().get_user(name=name)
    if result is None:
        return None
    return User(**result.model_dump())


def get_users() -> List[User]:
    """
    Get a list of all users in the registry.
    """
    return [User(**u.model_dump()) for u in _get_client().get_users()]


def create_user(name: str, email: str, role: str, extra_roles: Optional[List[str]] = None) -> None:
    """
    Create a new user in the registry.

    Args:
        name: Username of user to create.
        email: Email of user to create.
        role: Active role of the user.
        extra_roles: Additional roles to assign to the user.
    """

    _handle_errors(
        _get_client().create_user(input=_graphql_client.UserInput(name=name, email=email, role=role, extra_roles=extra_roles))
    )


def delete_user(name: str) -> None:
    """
    Delete user from the registry.

    Args:
        name: Username of user to delete.
    """
    result = _get_client().delete_user(name=name)
    if result is None:
        raise UserNotFoundError
    _handle_errors(result.delete)


def get_roles() -> List[Union[_graphql_client.GetRolesRolesUnmanagedRole, _graphql_client.GetRolesRolesManagedRole]]:
    """
    Get a list of all roles in the registry.
    """
    return [role_adapter.validate_python(r.model_dump()) for r in _get_client().get_roles()]


def set_role(
    name: str,
    role: str,
    extra_roles: Optional[List[str]] = None,
    *,
    append: bool = False,
) -> None:
    """
    Set the active and extra roles for a user.

    Args:
        name: Username of user to update.
        role: Role to be set as the active role.
        extra_roles: Additional roles to assign to the user.
        append: If True, append the extra roles to the existing roles. If False, replace the existing roles.
    """
    result = _get_client().set_role(name=name, role=role, extra_roles=extra_roles, append=append)
    if result is None:
        raise UserNotFoundError
    _handle_errors(result.set_role)


def add_roles(name: str, roles: List[str]) -> None:
    """
    Add roles to a user.

    Args:
        name: Username of user to update.
        roles: Roles to add to the user.
    """
    result = _get_client().add_roles(name=name, roles=roles)
    if result is None:
        raise UserNotFoundError
    _handle_errors(result.add_roles)


def remove_roles(
    name: str,
    roles: List[str],
    fallback: Optional[str] = None,
) -> None:
    """
    Remove roles from a user.

    Args:
        name: Username of user to update.
        roles: Roles to remove from the user.
        fallback: If set, the role to assign to the user if the active role is removed.
    """
    result = _get_client().remove_roles(name=name, roles=roles, fallback=fallback)
    if result is None:
        raise UserNotFoundError
    _handle_errors(result.remove_roles)
