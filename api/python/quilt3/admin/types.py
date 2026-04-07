import typing as T
from datetime import datetime

import pydantic

from .. import _graphql_client

BucketPermissionLevel = _graphql_client.BucketPermissionLevel


@pydantic.dataclasses.dataclass
class Permission:
    bucket: str
    level: BucketPermissionLevel

    @pydantic.field_validator("bucket", mode="before")
    @classmethod
    def _extract_bucket_name(cls, v):
        return v["name"] if isinstance(v, dict) else v

    @classmethod
    def read(cls, bucket: str) -> "Permission":
        return cls(bucket=bucket, level=BucketPermissionLevel.READ)

    @classmethod
    def read_write(cls, bucket: str) -> "Permission":
        return cls(bucket=bucket, level=BucketPermissionLevel.READ_WRITE)


@pydantic.dataclasses.dataclass
class PolicySummary:
    """Policy without back-references to roles (avoids circular nesting)."""

    id: str
    title: str
    arn: str
    managed: bool
    permissions: list[Permission]


@pydantic.dataclasses.dataclass
class ManagedRole:
    id: str
    name: str
    arn: str
    policies: list[PolicySummary]
    permissions: list[Permission]
    typename__: T.Literal["ManagedRole"]


@pydantic.dataclasses.dataclass
class UnmanagedRole:
    id: str
    name: str
    arn: str
    typename__: T.Literal["UnmanagedRole"]


Role = T.Union[ManagedRole, UnmanagedRole]
AnnotatedRole = T.Annotated[Role, pydantic.Field(discriminator="typename__")]


@pydantic.dataclasses.dataclass
class Policy:
    id: str
    title: str
    arn: str
    managed: bool
    permissions: list[Permission]
    roles: list[AnnotatedRole]

    @classmethod
    def from_gql(cls, gql: _graphql_client.BaseModel) -> "Policy":
        return cls(**gql.model_dump())


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
    role: T.Optional[AnnotatedRole]
    extra_roles: list[AnnotatedRole]

    @classmethod
    def from_gql(cls, gql: _graphql_client.BaseModel) -> "User":
        return cls(**gql.model_dump())


@pydantic.dataclasses.dataclass
class SSOConfig:
    text: str
    timestamp: datetime
    uploader: User

    @classmethod
    def from_gql(cls, gql: _graphql_client.BaseModel) -> "SSOConfig":
        return cls(**gql.model_dump())


@pydantic.dataclasses.dataclass
class TabulatorTable:
    name: str
    config: str


@pydantic.dataclasses.dataclass
class Bucket:
    name: str
    title: str
    icon_url: T.Optional[str]
    description: T.Optional[str]
    overview_url: T.Optional[str]
    tags: T.Optional[list[str]]
    relevance_score: int
    last_indexed: T.Optional[datetime]
    sns_notification_arn: T.Optional[str]
    scanner_parallel_shards_depth: T.Optional[int]
    skip_meta_data_indexing: T.Optional[bool]
    file_extensions_to_index: T.Optional[list[str]]
    index_content_bytes: T.Optional[int]
    prefixes: list[str]
