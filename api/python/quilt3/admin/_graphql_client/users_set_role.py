# Generated by ariadne-codegen
# Source: queries.graphql

from typing import Literal, Optional, Union

from pydantic import Field

from .base_model import BaseModel
from .fragments import InvalidInputSelection, OperationErrorSelection, UserSelection


class UsersSetRole(BaseModel):
    admin: "UsersSetRoleAdmin"


class UsersSetRoleAdmin(BaseModel):
    user: "UsersSetRoleAdminUser"


class UsersSetRoleAdminUser(BaseModel):
    mutate: Optional["UsersSetRoleAdminUserMutate"]


class UsersSetRoleAdminUserMutate(BaseModel):
    set_role: Union[
        "UsersSetRoleAdminUserMutateSetRoleUser",
        "UsersSetRoleAdminUserMutateSetRoleInvalidInput",
        "UsersSetRoleAdminUserMutateSetRoleOperationError",
    ] = Field(alias="setRole", discriminator="typename__")


class UsersSetRoleAdminUserMutateSetRoleUser(UserSelection):
    typename__: Literal["User"] = Field(alias="__typename")


class UsersSetRoleAdminUserMutateSetRoleInvalidInput(InvalidInputSelection):
    typename__: Literal["InvalidInput"] = Field(alias="__typename")


class UsersSetRoleAdminUserMutateSetRoleOperationError(OperationErrorSelection):
    typename__: Literal["OperationError"] = Field(alias="__typename")


UsersSetRole.model_rebuild()
UsersSetRoleAdmin.model_rebuild()
UsersSetRoleAdminUser.model_rebuild()
UsersSetRoleAdminUserMutate.model_rebuild()
