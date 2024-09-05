from datetime import datetime
from typing import Annotated, List, Literal, Optional, Union

import pydantic


@pydantic.dataclasses.dataclass
class ManagedRole:
    id: str
    name: str
    arn: str
    typename__: Literal["ManagedRole"]


@pydantic.dataclasses.dataclass
class UnmanagedRole:
    id: str
    name: str
    arn: str
    typename__: Literal["UnmanagedRole"]


Role = Union[ManagedRole, UnmanagedRole]
AnnotatedRole = Annotated[Role, pydantic.Field(discriminator="typename__")]
role_adapter = pydantic.TypeAdapter(AnnotatedRole)


@pydantic.dataclasses.dataclass
class User:
    name: str
    email: str
    date_joined: datetime
    last_login: datetime
    is_active: bool
    is_admin: bool
    is_sso_only: bool
    is_service: bool
    role: Optional[AnnotatedRole]
    extra_roles: List[AnnotatedRole]


@pydantic.dataclasses.dataclass
class SSOConfig:
    text: str
    timestamp: datetime
    uploader: User
