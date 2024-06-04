from typing import Any, Union, Optional, List

from graphql_client import *
from graphql_client.base_model import UNSET, UnsetType


class UserNotFoundError(Exception):
    pass


def handle_errors(result: BaseModel) -> Any:
    if isinstance(result, (InvalidInputSelection, OperationErrorSelection)):
        raise Exception(result)  # TODO: Proper error handling
    return result



class Client(Client):
    def get_user(self, name: str) -> GetUserAdminUserGet:
        result = super().get_user(name=name)
        # XXX: should we really throw an exception here?
        if result is None:
            raise UserNotFoundError
        return result

    def get_users(self) -> List[GetUsersAdminUserList]:
        return super().get_users()

    def create_user(self, input: UserInput) -> None:
        handle_errors(super().create_user(input=input))
        return None

    def get_role(self, role_id: str) -> Optional[Union[GetRoleRoleUnmanagedRole, GetRoleRoleManagedRole]]:
        # XXX: should we throw an exception here if the role is not found?
        return super().get_role(role_id=role_id)

    def get_roles(self) -> List[Union[GetRolesRolesUnmanagedRole, GetRolesRolesManagedRole]]:
        return super().get_roles()

    def set_role(
        self,
        name: str,
        role: str,
        extra_roles: Union[Optional[List[str]], UnsetType] = UNSET,
        *,
        append: bool = False,
    ) -> None:
        result = super().set_role(name=name, role=role, extra_roles=extra_roles, append=append)
        if result is None:
            raise UserNotFoundError
        handle_errors(result.set_role)
        return None

    def add_roles(
        self, roles: List[str], name: str
    ) -> None:
        result = super().add_roles(roles=roles, name=name)
        if result is None:
            raise UserNotFoundError
        handle_errors(result.add_roles)
        return None

    def remove_roles(
        self,
        roles: List[str],
        name: str,
        fallback: Union[Optional[str], UnsetType] = UNSET,
    ) -> None:
        result = super().remove_roles(roles=roles, name=name, fallback=fallback)
        if result is None:
            raise UserNotFoundError
        handle_errors(result.remove_roles)
        return None