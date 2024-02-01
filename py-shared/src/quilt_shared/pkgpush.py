from __future__ import annotations

import enum
import typing as T

import pydantic

from .aws import AWSCredentials
from .types import NonEmptyStr

if T.TYPE_CHECKING:
    from types_aiobotocore_s3.type_defs import CopySourceTypeDef

    from quilt3.util import PhysicalKey


class TopHash(pydantic.ConstrainedStr):
    min_length = 64
    max_length = 64
    regex = r"^[0-9a-f]+$"
    strip_whitespace = True
    to_lower = True


class S3ObjectSource(pydantic.BaseModel):
    bucket: str
    key: str
    version: T.Optional[str]

    @classmethod
    def from_pk(cls, pk: PhysicalKey):
        return S3ObjectSource(bucket=pk.bucket, key=pk.path, version=pk.version_id)

    @property
    def boto_args(self) -> CopySourceTypeDef:
        boto_args: CopySourceTypeDef = {
            "Bucket": self.bucket,
            "Key": self.key,
        }
        if self.version is not None:
            boto_args["VersionId"] = self.version
        return boto_args


class S3ObjectDestination(pydantic.BaseModel):
    bucket: str
    key: str

    @property
    def boto_args(self):
        return {
            "Bucket": self.bucket,
            "Key": self.key,
        }


class S3HashLambdaParams(pydantic.BaseModel):
    credentials: AWSCredentials
    location: S3ObjectSource


class ChecksumType(str, enum.Enum):
    MP = "QuiltMultipartSHA256"
    SP = "SHA256"


class Checksum(pydantic.BaseModel):
    type: ChecksumType
    value: str

    def __str__(self):
        return f"{self.type}:{self.value}"

    def __repr__(self):
        return f"{self.__class__.__name__}({self!s})"


# XXX: maybe it doesn't make sense outside of s3hash lambda
class MPURef(pydantic.BaseModel):
    bucket: str
    key: str
    id: str

    @property
    def boto_args(self):
        return {
            "Bucket": self.bucket,
            "Key": self.key,
            "UploadId": self.id,
        }


class ChecksumResult(pydantic.BaseModel):
    checksum: Checksum


class PackagePushParams(pydantic.BaseModel):
    bucket: NonEmptyStr
    # XXX: validate package name?
    # e.g. quilt3.util.validate_package_name(name)
    name: NonEmptyStr
    message: T.Optional[NonEmptyStr] = None
    user_meta: T.Optional[T.Dict[str, T.Any]] = None
    workflow: T.Optional[str] = None

    @property
    def workflow_normalized(self):
        # use default
        if self.workflow is None:
            return ...

        # not selected
        if self.workflow == "":
            return None

        return self.workflow


class PackagePushResult(pydantic.BaseModel):
    top_hash: TopHash


class PackagePromoteSource(pydantic.BaseModel):
    bucket: NonEmptyStr
    name: NonEmptyStr
    hash: TopHash


class PackagePromoteParams(PackagePushParams):
    src: PackagePromoteSource


class PackageConstructEntry(pydantic.BaseModel):
    logical_key: NonEmptyStr
    physical_key: NonEmptyStr
    size: T.Optional[int] = None
    hash: T.Optional[Checksum] = None
    # `meta` is the full metadata dict for entry that includes
    # optional `user_meta` property,
    # see PackageEntry._meta vs PackageEntry.meta.
    meta: T.Optional[T.Dict[str, T.Any]] = None
