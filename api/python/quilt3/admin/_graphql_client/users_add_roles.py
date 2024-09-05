# Generated by ariadne-codegen
# Source: queries.graphql

from typing import Literal, Optional, Union

from pydantic import Field

from .base_model import BaseModel
from .fragments import InvalidInputSelection, OperationErrorSelection, UserSelection


class UsersAddRoles(BaseModel):
    admin: "UsersAddRolesAdmin"


class UsersAddRolesAdmin(BaseModel):
    user: "UsersAddRolesAdminUser"


class UsersAddRolesAdminUser(BaseModel):
    mutate: Optional["UsersAddRolesAdminUserMutate"]


class UsersAddRolesAdminUserMutate(BaseModel):
    add_roles: Union[
        "UsersAddRolesAdminUserMutateAddRolesUser",
        "UsersAddRolesAdminUserMutateAddRolesInvalidInput",
        "UsersAddRolesAdminUserMutateAddRolesOperationError",
    ] = Field(alias="addRoles", discriminator="typename__")


class UsersAddRolesAdminUserMutateAddRolesUser(UserSelection):
    typename__: Literal["User"] = Field(alias="__typename")


class UsersAddRolesAdminUserMutateAddRolesInvalidInput(InvalidInputSelection):
    typename__: Literal["InvalidInput"] = Field(alias="__typename")


class UsersAddRolesAdminUserMutateAddRolesOperationError(OperationErrorSelection):
    typename__: Literal["OperationError"] = Field(alias="__typename")


UsersAddRoles.model_rebuild()
UsersAddRolesAdmin.model_rebuild()
UsersAddRolesAdminUser.model_rebuild()
UsersAddRolesAdminUserMutate.model_rebuild()
