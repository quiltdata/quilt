# Generated by ariadne-codegen
# Source: queries.graphql

from typing import Optional

from pydantic import Field

from .base_model import BaseModel
from .fragments import SsoConfigSelection


class SsoConfigGet(BaseModel):
    admin: "SsoConfigGetAdmin"


class SsoConfigGetAdmin(BaseModel):
    sso_config: Optional["SsoConfigGetAdminSsoConfig"] = Field(alias="ssoConfig")


class SsoConfigGetAdminSsoConfig(SsoConfigSelection):
    pass


SsoConfigGet.model_rebuild()
SsoConfigGetAdmin.model_rebuild()