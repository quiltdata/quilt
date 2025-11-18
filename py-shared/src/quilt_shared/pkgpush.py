from __future__ import annotations

import base64
import enum
import functools
import hashlib
import random
import typing as T

import pydantic.v1

from .aws import AWSCredentials
from .crc64 import combine_crc64nvme
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


class ChecksumAlgorithm(str, enum.Enum):
    """Algorithm identifiers for checksum computation (used in parameters, comparisons)."""

    SHA256_CHUNKED = "SHA256_CHUNKED"
    CRC64NVME = "CRC64NVME"


class ChecksumType(str, enum.Enum):
    """Checksum type identifiers for manifest serialization (includes legacy types)."""

    SHA256 = "SHA256"  # legacy
    SHA256_CHUNKED = "sha2-256-chunked"
    CRC64NVME = "CRC64NVME"  # AWS native, default for objects uploaded after Dec 2024


class Checksum(pydantic.v1.BaseModel):
    type: ChecksumType
    value: str

    def __str__(self):
        return f"{self.type}:{self.value}"

    def __repr__(self):
        return f"{self.__class__.__name__}({self!s})"

    # Factory methods for creating checksums from raw bytes

    @classmethod
    def sha256(cls, value: bytes):
        """Create SHA256 checksum from digest bytes (hex-encoded)."""
        return cls(value=value.hex(), type=ChecksumType.SHA256)

    @classmethod
    def sha256_chunked(cls, value: bytes):
        """Create SHA256_CHUNKED checksum from digest bytes (base64-encoded)."""
        return cls(value=base64.b64encode(value).decode(), type=ChecksumType.SHA256_CHUNKED)

    @classmethod
    def crc64nvme(cls, value: bytes):
        """Create CRC64NVME checksum from 8-byte CRC (base64-encoded)."""
        return cls(value=base64.b64encode(value).decode(), type=ChecksumType.CRC64NVME)

    # Constructors from parts

    @staticmethod
    def sha256_concat_and_hash(parts: T.Sequence[bytes]) -> bytes:
        """Concatenate and hash parts (for SHA256_CHUNKED)."""
        return hashlib.sha256(b"".join(parts)).digest()

    @classmethod
    def sha256_chunked_from_parts(cls, part_checksums: T.Sequence[bytes]):
        """Create SHA256_CHUNKED checksum from part checksums (double hash)."""
        return cls.sha256_chunked(cls.sha256_concat_and_hash(part_checksums))

    @classmethod
    def crc64nvme_from_parts(cls, part_checksums: T.Sequence[bytes], part_sizes: T.Sequence[int]):
        """Create CRC64NVME checksum from part checksums and sizes."""
        combined = combine_crc64nvme(part_checksums, part_sizes)
        return cls.crc64nvme(combined)

    # Empty checksums
    _EMPTY_SHA256 = hashlib.sha256().digest()
    _EMPTY_CRC64NVME = b"\x00" * 8  # CRC64 of empty object is 0

    @classmethod
    @functools.cache
    def empty_sha256(cls):
        """Empty file SHA256 checksum."""
        return cls.sha256(cls._EMPTY_SHA256)

    @classmethod
    @functools.cache
    def empty_sha256_chunked(cls):
        """Empty file SHA256_CHUNKED checksum.

        Note: Per CHUNKED_CHECKSUMS.md spec, empty files use single hash
        (NOT double hash like non-empty files). This is a special case.
        """
        return cls.sha256_chunked(cls._EMPTY_SHA256)

    @classmethod
    @functools.cache
    def empty_crc64nvme(cls):
        """Empty file CRC64NVME checksum (all zeros)."""
        return cls.crc64nvme(cls._EMPTY_CRC64NVME)

    @classmethod
    def get_empty(cls, algorithm: ChecksumAlgorithm):
        """Get empty checksum for algorithm.

        Args:
            algorithm: ChecksumAlgorithm enum value

        Returns:
            Checksum for empty file
        """
        if algorithm == ChecksumAlgorithm.CRC64NVME:
            return cls.empty_crc64nvme()
        if algorithm == ChecksumAlgorithm.SHA256_CHUNKED:
            return cls.empty_sha256_chunked()

        # Should never happen with proper typing
        assert False, f"Unsupported algorithm: {algorithm}"

    # S3 response parsing
    @classmethod
    def from_s3_checksum(cls, algorithm: ChecksumAlgorithm, checksum_value: str):
        """Parse checksum from S3 API response (base64-encoded).

        Args:
            algorithm: ChecksumAlgorithm enum value
            checksum_value: Base64-encoded checksum from S3 response

        Returns:
            Checksum object
        """
        checksum_bytes = base64.b64decode(checksum_value)
        if algorithm == ChecksumAlgorithm.CRC64NVME:
            return cls.crc64nvme(checksum_bytes)
        if algorithm == ChecksumAlgorithm.SHA256_CHUNKED:
            return cls.sha256_chunked(checksum_bytes)

        # Should never happen with proper typing
        assert False, f"Unsupported algorithm: {algorithm}"


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


class S3HashLambdaParams(pydantic.v1.BaseModel):
    credentials: AWSCredentials
    scratch_buckets: T.Dict[str, str]
    location: S3ObjectSource
    checksum_algorithm: ChecksumAlgorithm = ChecksumAlgorithm.SHA256_CHUNKED


class S3CopyLambdaParams(pydantic.v1.BaseModel):
    credentials: AWSCredentials
    location: S3ObjectSource
    target: S3ObjectDestination


def make_scratch_key() -> str:
    # randomize key to avoid S3 throttling
    return f"user-requests/checksum-upload-tmp/{random.randbytes(4).hex()}/object"
