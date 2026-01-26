"""
Pure checksum calculation algorithms for Quilt packages.

This module contains self-contained checksum implementations with no dependencies
on S3 operations or file transfer logic. For orchestration and S3-coupled checksum
operations, see data_transfer.py.
"""

from __future__ import annotations

import abc
import binascii
import dataclasses
import hashlib
import math
import typing as T

import awscrt.checksums

ChecksumT = T.TypeVar("ChecksumT", int, bytes)


SHA256_HASH_NAME = "SHA256"
SHA256_CHUNKED_HASH_NAME = "sha2-256-chunked"
CRC64NVME_HASH_NAME = "CRC64NVME"

DEFAULT_HASH = SHA256_CHUNKED_HASH_NAME


# 8 MiB - same as TransferConfig().multipart_threshold - but hard-coded to guarantee it won't change.
CHECKSUM_MULTIPART_THRESHOLD = 8 * 1024 * 1024

# Maximum number of parts supported by S3
CHECKSUM_MAX_PARTS = 10_000

_EMPTY_STRING_SHA256 = hashlib.sha256(b"").digest()

CRC64_BYTES = 8
CRC64_BYTEORDER = "big"


def _encode_checksum_bytes(data: bytes) -> str:
    return binascii.b2a_base64(data, newline=False).decode()


def crc64nvme_to_bytes(crc: int) -> bytes:
    return crc.to_bytes(CRC64_BYTES, byteorder=CRC64_BYTEORDER)


def get_checksum_chunksize(file_size: int) -> int:
    """
    Calculate the chunk size to be used for the checksum. It is normally 8 MiB,
    but gets doubled as long as the number of parts exceeds the maximum of 10,000.

    It is the same as
    `ChunksizeAdjuster().adjust_chunksize(s3_transfer_config.multipart_chunksize, file_size)`,
    but hard-coded to guarantee it won't change and make the current behavior a part of the API.
    """
    chunksize = 8 * 1024 * 1024
    num_parts = math.ceil(file_size / chunksize)

    while num_parts > CHECKSUM_MAX_PARTS:
        chunksize *= 2
        num_parts = math.ceil(file_size / chunksize)

    return chunksize


def is_mpu(file_size: int) -> bool:
    return file_size >= CHECKSUM_MULTIPART_THRESHOLD


def _simple_s3_to_quilt_checksum(s3_checksum: str) -> str:
    """
    Converts a SHA256 hash from a regular (non-multipart) S3 upload into a multipart hash,
    i.e., base64(sha256(bytes)) -> base64(sha256([sha256(bytes)])).

    Edge case: a 0-byte upload is treated as an empty list of chunks, rather than a list of a 0-byte chunk.
    Its checksum is sha256(''), NOT sha256(sha256('')).
    """
    s3_checksum_bytes = binascii.a2b_base64(s3_checksum)

    if s3_checksum_bytes == _EMPTY_STRING_SHA256:
        # Do not hash it again.
        return s3_checksum

    quilt_checksum_bytes = hashlib.sha256(s3_checksum_bytes).digest()
    return _encode_checksum_bytes(quilt_checksum_bytes)


@dataclasses.dataclass(frozen=True)
class ChecksumPart(T.Generic[ChecksumT]):
    checksum: ChecksumT
    size: int


# XXX: currently combine_parts() allows parts produced by *any* calculator with "compatible" checksum type.
# Should we do something about it?
class MultiPartChecksumCalculator(abc.ABC, T.Generic[ChecksumT]):
    """
    Checksum algorithm where final result is derived from per-part checksums.

    Each instance computes one part's checksum. Use combine_parts() to get
    the final checksum from all parts.
    """
    _registry: dict[str, type[MultiPartChecksumCalculator]] = {}
    checksum_type: T.ClassVar[str]

    def __init_subclass__(cls, checksum_type: str, **kwargs):
        super().__init_subclass__(**kwargs)
        cls.checksum_type = checksum_type
        MultiPartChecksumCalculator._registry[checksum_type] = cls

    @classmethod
    def get_calculator_cls(cls, checksum_type: str) -> type[MultiPartChecksumCalculator]:
        try:
            return cls._registry[checksum_type]
        except KeyError:
            raise ValueError(f"Unsupported checksum type: {checksum_type}. Supported types: {list(cls._registry)}")

    @abc.abstractmethod
    def __init__(self): ...

    @abc.abstractmethod
    def update(self, data: bytes): ...

    @abc.abstractmethod
    def _get_checksum(self) -> ChecksumT: ...

    def digest(self, size: int) -> ChecksumPart[ChecksumT]:
        return ChecksumPart(self._get_checksum(), size)

    @staticmethod
    @abc.abstractmethod
    def combine_parts(checksum_parts: list[ChecksumPart[ChecksumT]]) -> str: ...


class SHA256MultiPartChecksumCalculator(MultiPartChecksumCalculator[bytes], checksum_type=SHA256_CHUNKED_HASH_NAME):
    def __init__(self):
        self._hash_obj = hashlib.sha256()

    def update(self, data: bytes):
        self._hash_obj.update(data)

    def _get_checksum(self) -> bytes:
        return self._hash_obj.digest()

    @staticmethod
    def combine_parts(checksum_parts: list[ChecksumPart[bytes]]) -> str:
        combined_hash = hashlib.sha256(b"".join([p.checksum for p in checksum_parts])).digest()
        return _encode_checksum_bytes(combined_hash)


class CRC64NVMEMultiPartChecksumCalculator(MultiPartChecksumCalculator[int], checksum_type=CRC64NVME_HASH_NAME):
    def __init__(self):
        self._crc = 0

    def update(self, data: bytes):
        self._crc = awscrt.checksums.crc64nvme(data, self._crc)

    def _get_checksum(self) -> int:
        return self._crc

    @staticmethod
    def combine_parts(checksum_parts: list[ChecksumPart[int]]) -> str:
        if not checksum_parts:
            combined_crc = 0
        else:
            combined_crc = checksum_parts[0].checksum
            for part in checksum_parts[1:]:
                combined_crc = awscrt.checksums.combine_crc64nvme(combined_crc, part.checksum, part.size)
        return _encode_checksum_bytes(crc64nvme_to_bytes(combined_crc))


def calculate_multipart_checksum_bytes(data: bytes, *, checksum_type: str) -> str:
    calculator_cls = MultiPartChecksumCalculator.get_calculator_cls(checksum_type)

    size = len(data)
    chunksize = get_checksum_chunksize(size)

    checksum_parts = []
    for start in range(0, size, chunksize):
        end = min(start + chunksize, size)
        calculator = calculator_cls()
        calculator.update(data[start:end])
        checksum_parts.append(calculator.digest(end - start))

    return calculator_cls.combine_parts(checksum_parts)


def calculate_checksum_bytes(data: bytes) -> str:
    # FIXME: leave for now, but remove later
    return calculate_multipart_checksum_bytes(data, checksum_type=SHA256_CHUNKED_HASH_NAME)


def legacy_calculate_checksum_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
