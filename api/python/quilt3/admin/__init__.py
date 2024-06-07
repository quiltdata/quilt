"""
APIs for Quilt administrators. 'Registry' refers to Quilt stack backend services, including identity management.
"""

from datetime import datetime
from typing import Annotated, Any, List, Literal, Optional, Union

from pydantic import Field, TypeAdapter

from ._graphql_client import *
from ._graphql_client.base_model import UNSET, UnsetType


class ManagedRole(BaseModel):
    typename__: Literal["ManagedRole"] = Field(alias="__typename")
    id: str
    name: str
    arn: str


class UnmanagedRole(BaseModel):
    typename__: Literal["UnmanagedRole"] = Field(alias="__typename")
    id: str
    name: str
    arn: str


Role = Union[ManagedRole, UnmanagedRole]
AnnotatedRole = Annotated[Role, Field(discriminator="typename__")]


class User(BaseModel):
    name: str
    email: str
    date_joined: datetime = Field()
    last_login: datetime = Field()
    is_active: bool = Field()
    is_admin: bool = Field()
    is_sso_only: bool = Field()
    is_service: bool = Field()
    role: Optional[AnnotatedRole] = Field()
    extra_roles: List[AnnotatedRole] = Field()


class UserNotFoundError(Exception):
    pass


def _handle_errors(result: BaseModel) -> Any:
    if isinstance(result, (InvalidInputSelection, OperationErrorSelection)):
        raise Exception(result)  # TODO: Proper error handling
    return result


# XXX: cache?
def _get_client():
    return Client()


def get_user(name: str) -> User:
    """
    Get a specific user from the registry.

    Args:
        name: Username of user to get.
    """
    result = _get_client().get_user(name=name)
    # XXX: should we really throw an exception here?
    if result is None:
        raise UserNotFoundError
    return User.model_validate(result.model_dump())


def get_users() -> List[User]:
    """
    Get a list of all users in the registry.
    """
    return [User.model_validate(u.model_dump()) for u in _get_client().get_users()]


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
        _get_client().create_user(input=UserInput(name=name, email=email, role=role, extra_roles=extra_roles))
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


def get_roles() -> List[Union[GetRolesRolesUnmanagedRole, GetRolesRolesManagedRole]]:
    """
    Get a list of all roles in the registry.
    """
    adapter = TypeAdapter(AnnotatedRole)
    return [adapter.validate_python(r.model_dump()) for r in _get_client().get_roles()]


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
