from typing import Any, Union, Optional, List

from ._graphql_client import *
from ._graphql_client.base_model import UNSET, UnsetType


class UserNotFoundError(Exception):
    pass


def _handle_errors(result: BaseModel) -> Any:
    if isinstance(result, (InvalidInputSelection, OperationErrorSelection)):
        raise Exception(result)  # TODO: Proper error handling
    return result


# XXX: cache?
def _get_client():
    return Client()


def get_user(name: str) -> GetUserAdminUserGet:
    result = _get_client().get_user(name=name)
    # XXX: should we really throw an exception here?
    if result is None:
        raise UserNotFoundError
    return result


def get_users() -> List[GetUsersAdminUserList]:
    return _get_client().get_users()


def create_user(name: str, email: str, role: str, extra_roles: Optional[List[str]] = None) -> None:
    _handle_errors(
        _get_client().create_user(input=UserInput(name=name, email=email, role=role, extra_roles=extra_roles))
    )
    return None


def get_role(role_id: str) -> Optional[Union[GetRoleRoleUnmanagedRole, GetRoleRoleManagedRole]]:
    # XXX: should we throw an exception here if the role is not found?
    return _get_client().get_role(role_id=role_id)


def get_roles() -> List[Union[GetRolesRolesUnmanagedRole, GetRolesRolesManagedRole]]:
    return _get_client().get_roles()


def set_role(
    name: str,
    role: str,
    extra_roles: Union[Optional[List[str]], UnsetType] = UNSET,
    *,
    append: bool = False,
) -> None:
    result = _get_client().set_role(name=name, role=role, extra_roles=extra_roles, append=append)
    if result is None:
        raise UserNotFoundError
    _handle_errors(result.set_role)
    return None


def add_roles(roles: List[str], name: str) -> None:
    result = _get_client().add_roles(roles=roles, name=name)
    if result is None:
        raise UserNotFoundError
    _handle_errors(result.add_roles)
    return None


def remove_roles(
    roles: List[str],
    name: str,
    fallback: Union[Optional[str], UnsetType] = UNSET,
) -> None:
    result = _get_client().remove_roles(roles=roles, name=name, fallback=fallback)
    if result is None:
        raise UserNotFoundError
    _handle_errors(result.remove_roles)
    return None
