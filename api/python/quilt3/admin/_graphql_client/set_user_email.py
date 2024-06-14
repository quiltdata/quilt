# Generated by ariadne-codegen
# Source: queries.graphql

from typing import Literal, Optional, Union

from pydantic import Field

from .base_model import BaseModel
from .fragments import InvalidInputSelection, OperationErrorSelection, UserSelection


class SetUserEmail(BaseModel):
    admin: "SetUserEmailAdmin"


class SetUserEmailAdmin(BaseModel):
    user: "SetUserEmailAdminUser"


class SetUserEmailAdminUser(BaseModel):
    mutate: Optional["SetUserEmailAdminUserMutate"]


class SetUserEmailAdminUserMutate(BaseModel):
    set_email: Union[
        "SetUserEmailAdminUserMutateSetEmailUser",
        "SetUserEmailAdminUserMutateSetEmailInvalidInput",
        "SetUserEmailAdminUserMutateSetEmailOperationError",
    ] = Field(alias="setEmail", discriminator="typename__")


class SetUserEmailAdminUserMutateSetEmailUser(UserSelection):
    typename__: Literal["User"] = Field(alias="__typename")


class SetUserEmailAdminUserMutateSetEmailInvalidInput(InvalidInputSelection):
    typename__: Literal["InvalidInput"] = Field(alias="__typename")


class SetUserEmailAdminUserMutateSetEmailOperationError(OperationErrorSelection):
    typename__: Literal["OperationError"] = Field(alias="__typename")


SetUserEmail.model_rebuild()
SetUserEmailAdmin.model_rebuild()
SetUserEmailAdminUser.model_rebuild()
SetUserEmailAdminUserMutate.model_rebuild()
