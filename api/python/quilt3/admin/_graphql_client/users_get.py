# Generated by ariadne-codegen
# Source: queries.graphql

from typing import Optional

from .base_model import BaseModel
from .fragments import UserSelection


class UsersGet(BaseModel):
    admin: "UsersGetAdmin"


class UsersGetAdmin(BaseModel):
    user: "UsersGetAdminUser"


class UsersGetAdminUser(BaseModel):
    get: Optional["UsersGetAdminUserGet"]


class UsersGetAdminUserGet(UserSelection):
    pass


UsersGet.model_rebuild()
UsersGetAdmin.model_rebuild()
UsersGetAdminUser.model_rebuild()
