from datetime import datetime
from typing import Annotated, List, Literal, Optional, Union

import pydantic

from .. import _graphql_client


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


BucketPermissionLevel = _graphql_client.BucketPermissionLevel


@pydantic.dataclasses.dataclass
class Permission:
    bucket: str
    level: BucketPermissionLevel


@pydantic.dataclasses.dataclass
class Policy:
    id: str
    title: str
    arn: str
    managed: bool
    permissions: List[Permission]
    roles: List[AnnotatedRole]


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


@pydantic.dataclasses.dataclass
class TabulatorTable:
    name: str
    config: str


@pydantic.dataclasses.dataclass
class Bucket:
    name: str
    title: str
    icon_url: Optional[str]
    description: Optional[str]
    overview_url: Optional[str]
    tags: Optional[List[str]]
    relevance_score: int
    last_indexed: Optional[datetime]
    sns_notification_arn: Optional[str]
    scanner_parallel_shards_depth: Optional[int]
    skip_meta_data_indexing: Optional[bool]
    file_extensions_to_index: Optional[List[str]]
    index_content_bytes: Optional[int]
    prefixes: List[str]


def parse_role(data: dict) -> Role:
    return role_adapter.validate_python(data)


def parse_permission(data: dict) -> Permission:
    bucket = data["bucket"]
    return Permission(
        bucket=bucket["name"] if isinstance(bucket, dict) else bucket,
        level=data["level"],
    )


def parse_policy(data: dict) -> Policy:
    return Policy(
        id=data["id"],
        title=data["title"],
        arn=data["arn"],
        managed=data["managed"],
        permissions=[parse_permission(permission) for permission in data["permissions"]],
        roles=[parse_role(role) for role in data["roles"]],
    )
