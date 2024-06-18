# Generated by ariadne-codegen
# Source: queries.graphql

from typing import Any, Dict, List, Optional, Union

from .base_client import BaseClient
from .base_model import UNSET, UnsetType
from .input_types import UserInput
from .roles_list import (
    RolesList,
    RolesListRolesManagedRole,
    RolesListRolesUnmanagedRole,
)
from .users_add_roles import UsersAddRoles, UsersAddRolesAdminUserMutate
from .users_create import (
    UsersCreate,
    UsersCreateAdminUserCreateInvalidInput,
    UsersCreateAdminUserCreateOperationError,
    UsersCreateAdminUserCreateUser,
)
from .users_delete import UsersDelete, UsersDeleteAdminUserMutate
from .users_get import UsersGet, UsersGetAdminUserGet
from .users_list import UsersList, UsersListAdminUserList
from .users_remove_roles import UsersRemoveRoles, UsersRemoveRolesAdminUserMutate
from .users_reset_password import UsersResetPassword, UsersResetPasswordAdminUserMutate
from .users_set_active import UsersSetActive, UsersSetActiveAdminUserMutate
from .users_set_admin import UsersSetAdmin, UsersSetAdminAdminUserMutate
from .users_set_email import UsersSetEmail, UsersSetEmailAdminUserMutate
from .users_set_role import UsersSetRole, UsersSetRoleAdminUserMutate


def gql(q: str) -> str:
    return q


class Client(BaseClient):
    def roles_list(
        self, **kwargs: Any
    ) -> List[Union[RolesListRolesUnmanagedRole, RolesListRolesManagedRole]]:
        query = gql(
            """
            query rolesList {
              roles {
                ...RoleSelection
              }
            }

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment RoleSelection on Role {
              __typename
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
            query=query, operation_name="rolesList", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return RolesList.model_validate(data).roles

    def users_get(self, name: str, **kwargs: Any) -> Optional[UsersGetAdminUserGet]:
        query = gql(
            """
            query usersGet($name: String!) {
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
              __typename
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
            query=query, operation_name="usersGet", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return UsersGet.model_validate(data).admin.user.get

    def users_list(self, **kwargs: Any) -> List[UsersListAdminUserList]:
        query = gql(
            """
            query usersList {
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
              __typename
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
            query=query, operation_name="usersList", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return UsersList.model_validate(data).admin.user.list

    def users_create(self, input: UserInput, **kwargs: Any) -> Union[
        UsersCreateAdminUserCreateUser,
        UsersCreateAdminUserCreateInvalidInput,
        UsersCreateAdminUserCreateOperationError,
    ]:
        query = gql(
            """
            mutation usersCreate($input: UserInput!) {
              admin {
                user {
                  create(input: $input) {
                    __typename
                    ...UserMutationSelection
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

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment OperationErrorSelection on OperationError {
              message
              name
              context
            }

            fragment RoleSelection on Role {
              __typename
              ...UnmanagedRoleSelection
              ...ManagedRoleSelection
            }

            fragment UnmanagedRoleSelection on UnmanagedRole {
              id
              name
              arn
            }

            fragment UserMutationSelection on UserResult {
              ...UserSelection
              ...InvalidInputSelection
              ...OperationErrorSelection
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
        variables: Dict[str, object] = {"input": input}
        response = self.execute(
            query=query, operation_name="usersCreate", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return UsersCreate.model_validate(data).admin.user.create

    def users_delete(
        self, name: str, **kwargs: Any
    ) -> Optional[UsersDeleteAdminUserMutate]:
        query = gql(
            """
            mutation usersDelete($name: String!) {
              admin {
                user {
                  mutate(name: $name) {
                    delete {
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
        variables: Dict[str, object] = {"name": name}
        response = self.execute(
            query=query, operation_name="usersDelete", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return UsersDelete.model_validate(data).admin.user.mutate

    def users_set_email(
        self, email: str, name: str, **kwargs: Any
    ) -> Optional[UsersSetEmailAdminUserMutate]:
        query = gql(
            """
            mutation usersSetEmail($email: String!, $name: String!) {
              admin {
                user {
                  mutate(name: $name) {
                    setEmail(email: $email) {
                      __typename
                      ...UserMutationSelection
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

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment OperationErrorSelection on OperationError {
              message
              name
              context
            }

            fragment RoleSelection on Role {
              __typename
              ...UnmanagedRoleSelection
              ...ManagedRoleSelection
            }

            fragment UnmanagedRoleSelection on UnmanagedRole {
              id
              name
              arn
            }

            fragment UserMutationSelection on UserResult {
              ...UserSelection
              ...InvalidInputSelection
              ...OperationErrorSelection
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
        variables: Dict[str, object] = {"email": email, "name": name}
        response = self.execute(
            query=query, operation_name="usersSetEmail", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return UsersSetEmail.model_validate(data).admin.user.mutate

    def users_set_admin(
        self, name: str, admin: bool, **kwargs: Any
    ) -> Optional[UsersSetAdminAdminUserMutate]:
        query = gql(
            """
            mutation usersSetAdmin($name: String!, $admin: Boolean!) {
              admin {
                user {
                  mutate(name: $name) {
                    setAdmin(admin: $admin) {
                      __typename
                      ...UserMutationSelection
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

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment OperationErrorSelection on OperationError {
              message
              name
              context
            }

            fragment RoleSelection on Role {
              __typename
              ...UnmanagedRoleSelection
              ...ManagedRoleSelection
            }

            fragment UnmanagedRoleSelection on UnmanagedRole {
              id
              name
              arn
            }

            fragment UserMutationSelection on UserResult {
              ...UserSelection
              ...InvalidInputSelection
              ...OperationErrorSelection
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
        variables: Dict[str, object] = {"name": name, "admin": admin}
        response = self.execute(
            query=query, operation_name="usersSetAdmin", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return UsersSetAdmin.model_validate(data).admin.user.mutate

    def users_set_active(
        self, active: bool, name: str, **kwargs: Any
    ) -> Optional[UsersSetActiveAdminUserMutate]:
        query = gql(
            """
            mutation usersSetActive($active: Boolean!, $name: String!) {
              admin {
                user {
                  mutate(name: $name) {
                    setActive(active: $active) {
                      __typename
                      ...UserMutationSelection
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

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment OperationErrorSelection on OperationError {
              message
              name
              context
            }

            fragment RoleSelection on Role {
              __typename
              ...UnmanagedRoleSelection
              ...ManagedRoleSelection
            }

            fragment UnmanagedRoleSelection on UnmanagedRole {
              id
              name
              arn
            }

            fragment UserMutationSelection on UserResult {
              ...UserSelection
              ...InvalidInputSelection
              ...OperationErrorSelection
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
        variables: Dict[str, object] = {"active": active, "name": name}
        response = self.execute(
            query=query, operation_name="usersSetActive", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return UsersSetActive.model_validate(data).admin.user.mutate

    def users_reset_password(
        self, name: str, **kwargs: Any
    ) -> Optional[UsersResetPasswordAdminUserMutate]:
        query = gql(
            """
            mutation usersResetPassword($name: String!) {
              admin {
                user {
                  mutate(name: $name) {
                    resetPassword {
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
        variables: Dict[str, object] = {"name": name}
        response = self.execute(
            query=query,
            operation_name="usersResetPassword",
            variables=variables,
            **kwargs
        )
        data = self.get_data(response)
        return UsersResetPassword.model_validate(data).admin.user.mutate

    def users_set_role(
        self,
        name: str,
        role: str,
        append: bool,
        extra_roles: Union[Optional[List[str]], UnsetType] = UNSET,
        **kwargs: Any
    ) -> Optional[UsersSetRoleAdminUserMutate]:
        query = gql(
            """
            mutation usersSetRole($name: String!, $role: String!, $extraRoles: [String!], $append: Boolean!) {
              admin {
                user {
                  mutate(name: $name) {
                    setRole(role: $role, extraRoles: $extraRoles, append: $append) {
                      __typename
                      ...UserSelection
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

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment OperationErrorSelection on OperationError {
              message
              name
              context
            }

            fragment RoleSelection on Role {
              __typename
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
        variables: Dict[str, object] = {
            "name": name,
            "role": role,
            "extraRoles": extra_roles,
            "append": append,
        }
        response = self.execute(
            query=query, operation_name="usersSetRole", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return UsersSetRole.model_validate(data).admin.user.mutate

    def users_add_roles(
        self, name: str, roles: List[str], **kwargs: Any
    ) -> Optional[UsersAddRolesAdminUserMutate]:
        query = gql(
            """
            mutation usersAddRoles($name: String!, $roles: [String!]!) {
              admin {
                user {
                  mutate(name: $name) {
                    addRoles(roles: $roles) {
                      __typename
                      ...UserSelection
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

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment OperationErrorSelection on OperationError {
              message
              name
              context
            }

            fragment RoleSelection on Role {
              __typename
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
        variables: Dict[str, object] = {"name": name, "roles": roles}
        response = self.execute(
            query=query, operation_name="usersAddRoles", variables=variables, **kwargs
        )
        data = self.get_data(response)
        return UsersAddRoles.model_validate(data).admin.user.mutate

    def users_remove_roles(
        self,
        name: str,
        roles: List[str],
        fallback: Union[Optional[str], UnsetType] = UNSET,
        **kwargs: Any
    ) -> Optional[UsersRemoveRolesAdminUserMutate]:
        query = gql(
            """
            mutation usersRemoveRoles($name: String!, $roles: [String!]!, $fallback: String) {
              admin {
                user {
                  mutate(name: $name) {
                    removeRoles(roles: $roles, fallback: $fallback) {
                      __typename
                      ...UserSelection
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

            fragment ManagedRoleSelection on ManagedRole {
              id
              name
              arn
            }

            fragment OperationErrorSelection on OperationError {
              message
              name
              context
            }

            fragment RoleSelection on Role {
              __typename
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
        variables: Dict[str, object] = {
            "name": name,
            "roles": roles,
            "fallback": fallback,
        }
        response = self.execute(
            query=query,
            operation_name="usersRemoveRoles",
            variables=variables,
            **kwargs
        )
        data = self.get_data(response)
        return UsersRemoveRoles.model_validate(data).admin.user.mutate
