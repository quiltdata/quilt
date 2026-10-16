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
class RoleSignup:
    """
    A role's access-code signup page: visitors who enter `access_code` on `/signup/<page>`
    sign up straight into the role.
    """

    page: str
    access_code: str
    title: str | None = None
    description: str | None = None

    def _to_gql(self) -> _graphql_client.RoleSignupInput:
        return _graphql_client.RoleSignupInput(
            page=self.page,
            access_code=self.access_code,
            title=self.title,
            description=self.description,
        )


@pydantic.dataclasses.dataclass
class ManagedRole:
    id: str
    name: str
    arn: str
    policies: list[PolicySummary]
    permissions: list[Permission]
    typename__: T.Literal["ManagedRole"]
    default_bucket: str | None = None
    signup: RoleSignup | None = None


@pydantic.dataclasses.dataclass
class UnmanagedRole:
    id: str
    name: str
    arn: str
    typename__: T.Literal["UnmanagedRole"]
    default_bucket: str | None = None
    signup: RoleSignup | None = None


Role = ManagedRole | UnmanagedRole
AnnotatedRole = T.Annotated[Role, pydantic.Field(discriminator="typename__")]
_role_adapter = pydantic.TypeAdapter(AnnotatedRole)


def _parse_role(gql: _graphql_client.BaseModel) -> Role:
    return _role_adapter.validate_python(gql.model_dump())


@pydantic.dataclasses.dataclass
class Policy:
    id: str
    title: str
    arn: str
    managed: bool
    permissions: list[Permission]
    roles: list[ManagedRole]

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
    role: AnnotatedRole | None
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
    icon_url: str | None
    description: str | None
    overview_url: str | None
    tags: list[str] | None
    relevance_score: int
    last_indexed: datetime | None
    sns_notification_arn: str | None
    scanner_parallel_shards_depth: int | None
    skip_meta_data_indexing: bool | None
    file_extensions_to_index: list[str] | None
    index_content_bytes: int | None
    prefixes: list[str]
