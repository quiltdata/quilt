from __future__ import annotations

import asyncio
import base64
import contextlib
import contextvars
import functools
import hashlib
import logging
import math
import os
import typing as T

import aiobotocore.config
import aiobotocore.response
import aiobotocore.session
import botocore.exceptions
import pydantic

from quilt_shared.aws import AWSCredentials
from quilt_shared.lambdas_errors import LambdaError
from quilt_shared.pkgpush import Checksum as ChecksumBase
from quilt_shared.pkgpush import (
    ChecksumResult,
    ChecksumType,
    MPURef,
    S3ObjectDestination,
    S3ObjectSource,
)

if T.TYPE_CHECKING:
    from types_aiobotocore_s3.client import S3Client
    from types_aiobotocore_s3.type_defs import GetObjectAttributesOutputTypeDef


logger = logging.getLogger("quilt-lambda-s3hash")
logger.setLevel(os.environ.get("QUILT_LOG_LEVEL", "WARNING"))

MPU_CONCURRENCY = int(os.environ["MPU_CONCURRENCY"])
MULTIPART_CHECKSUMS = os.environ["MULTIPART_CHECKSUMS"] == "true"
SERVICE_BUCKET = os.environ["SERVICE_BUCKET"]

SCRATCH_KEY_SERVICE = "user-requests/checksum-upload-tmp"

# How much seconds before lambda is supposed to timeout we give up.
SECONDS_TO_CLEANUP = 1

S3: contextvars.ContextVar[S3Client] = contextvars.ContextVar("s3")


# Isolated for test-ability.
def get_user_boto_session(credentials: AWSCredentials) -> aiobotocore.session.AioSession:
    s = aiobotocore.session.get_session()
    s.set_credentials(credentials.key, credentials.secret, credentials.token)
    return s


@contextlib.asynccontextmanager
async def aio_context(credentials: AWSCredentials):
    session = get_user_boto_session(credentials)
    config = aiobotocore.config.AioConfig(max_pool_connections=MPU_CONCURRENCY)

    async with session.create_client("s3", config=config) as s3:
        s3_token = S3.set(s3)
        try:
            yield
        finally:
            S3.reset(s3_token)


class Checksum(ChecksumBase):
    @classmethod
    def singlepart(cls, value: bytes):
        return cls(value=value.hex(), type=ChecksumType.SP)

    @classmethod
    def multipart(cls, parts: T.Sequence[bytes]):
        hash_list = hash_parts(parts)
        b64 = base64.b64encode(hash_list).decode()
        value = f"{b64}-{len(parts)}"
        return cls(value=value, type=ChecksumType.MP)

    @classmethod
    def for_parts(cls, checksums: T.Sequence[bytes], defs: T.Sequence[PartDef]):
        if defs == PARTS_SINGLE:
            return cls.singlepart(checksums[0])
        return cls.multipart(checksums)


# 8 MiB -- boto3 default:
# https://boto3.amazonaws.com/v1/documentation/api/latest/reference/customizations/s3.html#boto3.s3.transfer.TransferConfig
MIN_PART_SIZE = 1024**2 * 8
MAX_PART_SIZE = 5 * 2**30
MAX_PARTS = 10000  # Maximum number of parts per upload supported by S3


# XXX: import this logic from quilt3 when it's available
def get_part_size(file_size: int) -> T.Optional[int]:
    if file_size < MIN_PART_SIZE:
        return None  # use single-part upload (and plain SHA256 hash)

    # NOTE: in the case where file_size is exactly equal to MIN_PART_SIZE,
    # boto creates a 1-part multipart upload :shrug:
    part_size = MIN_PART_SIZE
    while math.ceil(file_size / part_size) > MAX_PARTS:
        part_size *= 2

    return part_size


async def get_obj_attributes(location: S3ObjectSource) -> T.Optional[GetObjectAttributesOutputTypeDef]:
    try:
        return await S3.get().get_object_attributes(
            **location.boto_args,
            ObjectAttributes=["ETag", "Checksum", "ObjectParts", "ObjectSize"],
            MaxParts=MAX_PARTS,
        )
    except botocore.exceptions.ClientError as e:
        if e.response.get("Error", {}).get("Code") == "AccessDenied":
            # Don't fail because it needs new permission.
            return None
        raise


def get_compliant_checksum(attrs: GetObjectAttributesOutputTypeDef) -> T.Optional[Checksum]:
    checksum_value = attrs.get("Checksum", {}).get("ChecksumSHA256")
    if checksum_value is None:
        return None

    part_size = get_part_size(attrs["ObjectSize"])
    object_parts = attrs.get("ObjectParts")
    if not MULTIPART_CHECKSUMS or part_size is None:
        if object_parts is not None:
            assert "TotalPartsCount" in object_parts
            if object_parts["TotalPartsCount"] != 1:
                return None
            assert "Parts" in object_parts
            assert "ChecksumSHA256" in object_parts["Parts"][0]
            checksum_value = object_parts["Parts"][0]["ChecksumSHA256"]

        return Checksum.singlepart(base64.b64decode(checksum_value))

    if object_parts is None:
        return None
    assert "TotalPartsCount" in object_parts
    num_parts = object_parts["TotalPartsCount"]
    assert "Parts" in object_parts
    # Make sure we have _all_ parts.
    assert len(object_parts["Parts"]) == num_parts
    if all(part.get("Size") == part_size for part in object_parts["Parts"][:-1]):
        return Checksum(
            type=ChecksumType.MP,
            value=f"{checksum_value}-{num_parts}",
        )

    return None


def hash_parts(parts: T.Sequence[bytes]) -> bytes:
    return hashlib.sha256(b"".join(parts)).digest()


class PartDef(pydantic.BaseModel):
    part_number: int
    range: T.Optional[T.Tuple[int, int]]

    @property
    def boto_args(self):
        args: T.Dict[str, T.Any] = {"PartNumber": self.part_number}
        if self.range:
            args["CopySourceRange"] = f"bytes={self.range[0]}-{self.range[1]}"
        return args

    @classmethod
    def for_range(cls, part_number: int, offset: int, size: int):
        return cls(
            part_number=part_number,
            range=(offset, offset + size - 1),
        )


PARTS_SINGLE = [PartDef(part_number=1, range=None)]


def get_parts_for_size(total_size: int) -> T.List[PartDef]:
    part_size = get_part_size(total_size)

    # single-part upload
    if part_size is None:
        return PARTS_SINGLE

    # multipart upload
    offset = 0
    part_number = 1
    parts = []
    while offset < total_size:
        actual_part_size = min(part_size, total_size - offset)
        parts.append(
            PartDef.for_range(
                part_number=part_number,
                offset=offset,
                size=actual_part_size,
            )
        )
        offset += actual_part_size
        part_number += 1

    return parts


async def upload_part(mpu: MPURef, src: S3ObjectSource, etag: str, part: PartDef) -> bytes:
    res = await S3.get().upload_part_copy(
        **mpu.boto_args,
        **part.boto_args,
        CopySource=src.boto_args,
        # In case we don't have version ID (e.g. non-versioned bucket)
        # we have to use ETag to make sure object is not modified during copy,
        # otherwise we can end up with invalid checksum.
        CopySourceIfMatch=etag,
    )
    cs = res["CopyPartResult"].get("ChecksumSHA256")  # base64-encoded
    assert cs is not None
    return base64.b64decode(cs)


async def compute_part_checksums(
    mpu: MPURef,
    location: S3ObjectSource,
    etag: str,
    parts: T.Sequence[PartDef],
) -> T.List[bytes]:
    s = asyncio.Semaphore(MPU_CONCURRENCY)

    async def _upload_part(*args, **kwargs):
        async with s:
            return await upload_part(*args, **kwargs)

    uploads = [_upload_part(mpu, location, etag, p) for p in parts]
    checksums: T.List[bytes] = await asyncio.gather(*uploads)
    return checksums


async def _create_mpu(target: S3ObjectDestination) -> MPURef:
    upload_data = await S3.get().create_multipart_upload(
        **target.boto_args,
        ChecksumAlgorithm="SHA256",
    )
    return MPURef(bucket=target.bucket, key=target.key, id=upload_data["UploadId"])


@contextlib.asynccontextmanager
async def create_mpu():
    dst = S3ObjectDestination(bucket=SERVICE_BUCKET, key=SCRATCH_KEY_SERVICE)

    try:
        mpu = await _create_mpu(dst)
    except botocore.exceptions.ClientError as ex:
        raise LambdaError("MPUError", {"dst": dst.dict(), "error": str(ex)})

    try:
        yield mpu
    finally:
        try:
            await S3.get().abort_multipart_upload(**mpu.boto_args)
        except Exception:
            # XXX: send to sentry
            logger.exception("Error aborting MPU")


# XXX: need a consistent way to serialize / deserialize exceptions
def lambda_wrapper(f):
    @functools.wraps(f)
    def wrapper(event, context):
        try:
            try:
                result = asyncio.run(
                    asyncio.wait_for(
                        f(**event),
                        context.get_remaining_time_in_millis() / 1000 - SECONDS_TO_CLEANUP,
                    )
                )
            except asyncio.TimeoutError:
                raise LambdaError("Timeout")
            except pydantic.ValidationError as e:
                # XXX: make it .info()?
                logger.exception("ValidationError")
                # TODO: expose advanced pydantic error reporting capabilities
                raise LambdaError("InvalidInputParameters", {"details": str(e)})
            return {"result": result.dict()}
        except LambdaError as e:
            logger.exception("LambdaError")
            return {"error": e.dict()}

    return wrapper


async def compute_checksum_legacy(location: S3ObjectSource) -> Checksum:
    resp = await S3.get().get_object(**location.boto_args)
    hashobj = hashlib.sha256()
    async with resp["Body"] as stream:
        async for chunk in stream.content.iter_any():
            hashobj.update(chunk)

    return Checksum.singlepart(hashobj.digest())


# XXX: move decorators to shared?
@lambda_wrapper
@pydantic.validate_arguments
async def lambda_handler(
    *,
    credentials: AWSCredentials,
    location: S3ObjectSource,
) -> ChecksumResult:
    async with aio_context(credentials):
        obj_attrs = await get_obj_attributes(location)
        if obj_attrs:
            checksum = get_compliant_checksum(obj_attrs)
            if checksum is not None:
                return ChecksumResult(checksum=checksum)

            etag, total_size = obj_attrs["ETag"], obj_attrs["ObjectSize"]
        else:
            resp = await S3.get().head_object(**location.boto_args)
            etag, total_size = resp["ETag"], resp["ContentLength"]

        if not MULTIPART_CHECKSUMS and total_size > MAX_PART_SIZE:
            checksum = await compute_checksum_legacy(location)
        else:
            part_defs = get_parts_for_size(total_size) if MULTIPART_CHECKSUMS else PARTS_SINGLE

            async with create_mpu() as mpu:
                part_checksums = await compute_part_checksums(
                    mpu,
                    location,
                    etag,
                    part_defs,
                )

            checksum = Checksum.for_parts(part_checksums, part_defs)

        return ChecksumResult(checksum=checksum)
