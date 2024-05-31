# Generated by ariadne-codegen
# Source: queries.graphql

from typing import Any, Dict, List, Optional, Union

from .base_client import BaseClient
from .base_model import UNSET, UnsetType
from .create_user import (
    CreateUser,
    CreateUserAdminUserCreateInvalidInput,
    CreateUserAdminUserCreateOperationError,
    CreateUserAdminUserCreateUser,
)
from .get_role import GetRole, GetRoleRoleManagedRole, GetRoleRoleUnmanagedRole
from .get_roles import GetRoles, GetRolesRolesManagedRole, GetRolesRolesUnmanagedRole
from .get_user import GetUser, GetUserAdminUserGet
from .get_users import GetUsers, GetUsersAdminUserList
from .input_types import UserInput
from .set_roles import SetRoles, SetRolesAdminUserMutate


def gql(q: str) -> str:
    return q


class Client(BaseClient):
    def create_user(self, input: UserInput, **kwargs: Any) -> Union[
        CreateUserAdminUserCreateUser,
        CreateUserAdminUserCreateInvalidInput,
        CreateUserAdminUserCreateOperationError,
    ]:
        query = gql(
            """
            mutation createUser($input: UserInput!) {
              admin {
                user {
                  create(input: $input) {
                    __typename
                    ...InvalidInputSelection
                    ...OperationErrorSelection
                  }
                }
              }
            }

            fragment InvalidInputSelection on InvalidInput {
              errors {
                path
                message
                name
                context
              }
            }

            fragment OperationErrorSelection on OperationError {
              message
              name
              context
            }
            """
        )
        variables: Dict[str, object] = {"input": input}
        response = self.execute(
            query=query, operation_name="createUser", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return CreateUser.model_validate(data).admin.user.create

    def get_user(self, name: str, **kwargs: Any) -> Optional[GetUserAdminUserGet]:
        query = gql(
            """
            query getUser($name: String!) {
              admin {
                user {
                  get(name: $name) {
                    ...UserSelection
                  }
                }
              }
            }

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment RoleSelection on Role {
              ...UnmanagedRoleSelection
              ...ManagedRoleSelection
            }

            fragment UnmanagedRoleSelection on UnmanagedRole {
              id
              name
              arn
            }

            fragment UserSelection on User {
              name
              email
              dateJoined
              lastLogin
              isActive
              isAdmin
              isSsoOnly
              isService
              role {
                ...RoleSelection
              }
              extraRoles {
                ...RoleSelection
              }
            }
            """
        )
        variables: Dict[str, object] = {"name": name}
        response = self.execute(
            query=query, operation_name="getUser", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return GetUser.model_validate(data).admin.user.get

    def get_users(self, **kwargs: Any) -> List[GetUsersAdminUserList]:
        query = gql(
            """
            query getUsers {
              admin {
                user {
                  list {
                    ...UserSelection
                  }
                }
              }
            }

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment RoleSelection on Role {
              ...UnmanagedRoleSelection
              ...ManagedRoleSelection
            }

            fragment UnmanagedRoleSelection on UnmanagedRole {
              id
              name
              arn
            }

            fragment UserSelection on User {
              name
              email
              dateJoined
              lastLogin
              isActive
              isAdmin
              isSsoOnly
              isService
              role {
                ...RoleSelection
              }
              extraRoles {
                ...RoleSelection
              }
            }
            """
        )
        variables: Dict[str, object] = {}
        response = self.execute(
            query=query, operation_name="getUsers", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return GetUsers.model_validate(data).admin.user.list

    def get_roles(
        self, **kwargs: Any
    ) -> List[Union[GetRolesRolesUnmanagedRole, GetRolesRolesManagedRole]]:
        query = gql(
            """
            query getRoles {
              roles {
                __typename
                ...RoleSelection
              }
            }

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment RoleSelection on Role {
              ...UnmanagedRoleSelection
              ...ManagedRoleSelection
            }

            fragment UnmanagedRoleSelection on UnmanagedRole {
              id
              name
              arn
            }
            """
        )
        variables: Dict[str, object] = {}
        response = self.execute(
            query=query, operation_name="getRoles", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return GetRoles.model_validate(data).roles

    def get_role(
        self, role_id: str, **kwargs: Any
    ) -> Optional[Union[GetRoleRoleUnmanagedRole, GetRoleRoleManagedRole]]:
        query = gql(
            """
            query getRole($roleId: ID!) {
              role(id: $roleId) {
                __typename
                ...RoleSelection
              }
            }

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment RoleSelection on Role {
              ...UnmanagedRoleSelection
              ...ManagedRoleSelection
            }

            fragment UnmanagedRoleSelection on UnmanagedRole {
              id
              name
              arn
            }
            """
        )
        variables: Dict[str, object] = {"roleId": role_id}
        response = self.execute(
            query=query, operation_name="getRole", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return GetRole.model_validate(data).role

    def set_roles(
        self,
        name: str,
        role: str,
        extra_roles: Union[Optional[List[str]], UnsetType] = UNSET,
        **kwargs: Any
    ) -> Optional[SetRolesAdminUserMutate]:
        query = gql(
            """
            mutation setRoles($name: String!, $role: String!, $extraRoles: [String!]) {
              admin {
                user {
                  mutate(name: $name) {
                    setRole(role: $role, extraRoles: $extraRoles) {
                      __typename
                      ...InvalidInputSelection
                      ...OperationErrorSelection
                    }
                  }
                }
              }
            }

            fragment InvalidInputSelection on InvalidInput {
              errors {
                path
                message
                name
                context
              }
            }

            fragment OperationErrorSelection on OperationError {
              message
              name
              context
            }
            """
        )
        variables: Dict[str, object] = {
            "name": name,
            "role": role,
            "extraRoles": extra_roles,
        }
        response = self.execute(
            query=query, operation_name="setRoles", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return SetRoles.model_validate(data).admin.user.mutate
