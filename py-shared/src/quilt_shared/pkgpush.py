from __future__ import annotations

import base64
import enum
import functools
import hashlib
import random
import typing as T

import pydantic.v1

from .aws import AWSCredentials
from .types import NonEmptyStr

if T.TYPE_CHECKING:
    from types_aiobotocore_s3.type_defs import CopySourceTypeDef

    from quilt3.util import PhysicalKey


class TopHash(pydantic.v1.ConstrainedStr):
    min_length = 64
    max_length = 64
    regex = r"^[0-9a-f]+$"
    strip_whitespace = True
    to_lower = True


class S3ObjectSource(pydantic.v1.BaseModel):
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


class S3ObjectDestination(pydantic.v1.BaseModel):
    bucket: str
    key: str

    @classmethod
    def from_pk(cls, pk: PhysicalKey):
        if pk.version_id is not None:
            raise ValueError("version_id is expected to be None")
        return S3ObjectDestination(bucket=pk.bucket, key=pk.path)

    @property
    def boto_args(self):
        return {
            "Bucket": self.bucket,
            "Key": self.key,
        }


class S3HashLambdaParams(pydantic.v1.BaseModel):
    credentials: AWSCredentials
    scratch_buckets: T.Dict[str, str]
    location: S3ObjectSource


class S3CopyLambdaParams(pydantic.v1.BaseModel):
    credentials: AWSCredentials
    location: S3ObjectSource
    target: S3ObjectDestination


class ChecksumType(str, enum.Enum):
    SHA256 = "SHA256"  # legacy
    SHA256_CHUNKED = "sha2-256-chunked"


class Checksum(pydantic.v1.BaseModel):
    type: ChecksumType
    value: str

    def __str__(self):
        return f"{self.type}:{self.value}"

    def __repr__(self):
        return f"{self.__class__.__name__}({self!s})"

    @staticmethod
    def hash_parts(parts: T.Sequence[bytes]) -> bytes:
        return hashlib.sha256(b"".join(parts)).digest()

    @classmethod
    def sha256(cls, value: bytes):
        return cls(value=value.hex(), type=ChecksumType.SHA256)

    @classmethod
    def sha256_chunked(cls, value: bytes):
        return cls(value=base64.b64encode(value).decode(), type=ChecksumType.SHA256_CHUNKED)

    @classmethod
    def for_parts(cls, checksums: T.Sequence[bytes]):
        return cls.sha256_chunked(cls.hash_parts(checksums))

    _EMPTY_HASH = hashlib.sha256().digest()

    @classmethod
    @functools.cache
    def empty_sha256(cls):
        return cls.sha256(cls._EMPTY_HASH)

    @classmethod
    @functools.cache
    def empty_sha256_chunked(cls):
        return cls.sha256_chunked(cls._EMPTY_HASH)


# XXX: maybe it doesn't make sense outside of s3hash lambda
class MPURef(pydantic.v1.BaseModel):
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


class ChecksumResult(pydantic.v1.BaseModel):
    checksum: Checksum


class CopyResult(pydantic.v1.BaseModel):
    version: T.Optional[str]


class PackagePushParams(pydantic.v1.BaseModel):
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


class PackagePushResult(pydantic.v1.BaseModel):
    top_hash: TopHash


class PackagePromoteSource(pydantic.v1.BaseModel):
    bucket: NonEmptyStr
    name: NonEmptyStr
    hash: TopHash


class PackagePromoteParams(PackagePushParams):
    # Used to rewrite the folder prefix for uploaded files when `copy_data: true`
    dest_prefix: T.Optional[NonEmptyStr] = None
    src: PackagePromoteSource


class PackageConstructParams(PackagePushParams):
    scratch_buckets: T.Dict[str, str]


class PackageConstructEntry(pydantic.v1.BaseModel):
    logical_key: NonEmptyStr
    physical_key: NonEmptyStr
    size: T.Optional[int] = None
    hash: T.Optional[Checksum] = None
    # `meta` is the full metadata dict for entry that includes
    # optional `user_meta` property,
    # see PackageEntry._meta vs PackageEntry.meta.
    meta: T.Optional[T.Dict[str, T.Any]] = None


def make_scratch_key() -> str:
    # randomize key to avoid S3 throttling
    return f"user-requests/checksum-upload-tmp/{random.randbytes(4).hex()}/object"
