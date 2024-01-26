from __future__ import annotations

import asyncio
import base64
import contextlib
import contextvars
import enum
import functools
import hashlib
import math
import os
import typing as T

import aiobotocore.config
import aiobotocore.response
import aiobotocore.session
import botocore.exceptions
import pydantic
import tenacity
import types_aiobotocore_s3.type_defs as T_S3TypeDefs
from types_aiobotocore_s3.client import S3Client

from t4_lambda_shared.utils import get_quilt_logger

logger = get_quilt_logger()

DEFAULT_CONCURRENCY = int(os.environ["MPU_CONCURRENCY"])
MULTIPART_CHECKSUMS = os.environ["MULTIPART_CHECKSUMS"] == "true"
SERVICE_BUCKET = os.environ["SERVICE_BUCKET"]

SCRATCH_KEY_SERVICE = "user-requests/checksum-upload-tmp"
SCRATCH_KEY_PER_BUCKET = ".quilt/.checksum-upload-tmp"

# How much seconds before lambda is supposed to timeout we give up.
SECONDS_TO_CLEANUP = 1

S3: contextvars.ContextVar[S3Client] = contextvars.ContextVar("s3")


NonEmptyStr = pydantic.constr(min_length=1, strip_whitespace=True)


class AWSCredentials(pydantic.BaseModel):
    key: NonEmptyStr
    secret: NonEmptyStr
    token: NonEmptyStr


# Isolated for test-ability.
def get_user_boto_session(
    credentials: AWSCredentials,
) -> aiobotocore.session.AioSession:
    s = aiobotocore.session.get_session()
    s.set_credentials(credentials.key, credentials.secret, credentials.token)
    return s


@contextlib.asynccontextmanager
async def aio_context(credentials: AWSCredentials, concurrency: pydantic.PositiveInt):
    session = get_user_boto_session(credentials)
    config = aiobotocore.config.AioConfig(max_pool_connections=concurrency)

    async with session.create_client("s3", config=config) as s3:
        s3_token = S3.set(s3)
        try:
            yield
        finally:
            S3.reset(s3_token)


class S3hashException(Exception):
    def __init__(self, name, context=None):
        super().__init__(name, context)
        self.name = name
        self.context = context

    def dict(self):
        return {"name": self.name, "context": self.context}


class ChecksumType(str, enum.Enum):
    MP = "QuiltMultipartSHA256"
    SP = "SHA256"


class Checksum(pydantic.BaseModel):
    type: ChecksumType
    value: str

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

    def __str__(self):
        return f"{self.type}:{self.value}"

    def __repr__(self):
        return f"{self.__class__.__name__}({self!s})"


class S3ObjectSource(pydantic.BaseModel):
    bucket: str
    key: str
    version: T.Optional[str]

    @property
    def boto_args(self) -> T_S3TypeDefs.CopySourceTypeDef:
        boto_args = {
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


# 8 MiB -- boto3 default:
# https://boto3.amazonaws.com/v1/documentation/api/latest/reference/customizations/s3.html#boto3.s3.transfer.TransferConfig
MIN_PART_SIZE = 1024**2 * 8
MAX_PARTS = 10000  # Maximum number of parts per upload supported by S3


# XXX: import this logic from quilt3 when it's available
def get_part_size(file_size: int) -> T.Optional[int]:
    if file_size < MIN_PART_SIZE:
        return None  # use single-part upload (and plain SHA256 hash)

    # NOTE: in the case where file_size is exactly equal to MIN_PART_SIZE,
    # boto creates a 1-part multipart upload :shrug:
    part_size = MIN_PART_SIZE
    num_parts = math.ceil(file_size / part_size)

    while num_parts > MAX_PARTS:
        part_size *= 2
        num_parts = math.ceil(file_size / part_size)

    return part_size


async def get_existing_checksum(
    location: S3ObjectSource,
) -> T.Optional[Checksum]:
    try:
        resp = await S3.get().get_object_attributes(
            **location.boto_args,
            ObjectAttributes=["Checksum", "ObjectParts", "ObjectSize"],
            MaxParts=MAX_PARTS,
        )
    except botocore.exceptions.ClientError as e:
        if e.response.get("Error", {}).get("Code") == "AccessDenied":
            # Don't fail because it needs new permission.
            return None
        raise

    checksum_value = resp.get("Checksum", {}).get("ChecksumSHA256")
    if checksum_value is None:
        return None

    part_size = get_part_size(resp["ObjectSize"])
    object_parts = resp.get("ObjectParts")
    if object_parts is None:
        if not MULTIPART_CHECKSUMS or part_size is None:
            return Checksum.singlepart(base64.b64decode(checksum_value))
        else:
            return None

    num_parts = object_parts["TotalPartsCount"]
    assert len(object_parts["Parts"]) == num_parts
    if all(part["Size"] == part_size for part in object_parts["Parts"][:-1]):
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


async def get_parts_for_location(location: S3ObjectSource) -> T.List[PartDef]:
    total_size = (await S3.get().head_object(**location.boto_args))["ContentLength"]
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


@tenacity.retry
async def upload_part(mpu: MPURef, src: S3ObjectSource, part: PartDef) -> bytes:
    res = await S3.get().upload_part_copy(
        **mpu.boto_args,
        **part.boto_args,
        CopySource=src.boto_args,
    )
    cs = res["CopyPartResult"].get("ChecksumSHA256")  # base64-encoded
    assert cs is not None
    return base64.b64decode(cs)


async def compute_part_checksums(
    mpu: MPURef,
    location: S3ObjectSource,
    parts: T.Sequence[PartDef],
    concurrency: int,
) -> T.Tuple[T.List[bytes], T.Any]:
    s = asyncio.Semaphore(concurrency)

    async def _upload_part(*args, **kwargs):
        async with s:
            return await upload_part(*args, **kwargs)

    uploads = [_upload_part(mpu, location, p) for p in parts]
    checksums: T.List[bytes] = await asyncio.gather(*uploads)
    return checksums, upload_part.retry.statistics


async def _create_mpu(target: S3ObjectDestination) -> MPURef:
    upload_data = await S3.get().create_multipart_upload(
        **target.boto_args,
        ChecksumAlgorithm="SHA256",
    )
    return MPURef(bucket=target.bucket, key=target.key, id=upload_data["UploadId"])


def get_mpu_dsts(src: S3ObjectSource, target: T.Optional[S3ObjectDestination]) -> T.List[S3ObjectDestination]:
    dsts = [
        S3ObjectDestination(bucket=src.bucket, key=SCRATCH_KEY_PER_BUCKET),
        S3ObjectDestination(bucket=SERVICE_BUCKET, key=SCRATCH_KEY_SERVICE),
    ]
    if target is not None:
        dsts.insert(0, target)
    return dsts


MPUDstError = T.Tuple[S3ObjectDestination, botocore.exceptions.ClientError]


@contextlib.asynccontextmanager
async def create_mpu(src: S3ObjectSource, target: T.Optional[S3ObjectDestination]):
    dsts = get_mpu_dsts(src, target)

    errors: T.List[T.Tuple[S3ObjectDestination, botocore.exceptions.ClientError]] = []

    for dst in dsts:
        try:
            mpu = await _create_mpu(dst)
            break
        except botocore.exceptions.ClientError as ex:
            errors.append((dst, ex))
    else:
        raise S3hashException("MPUError", {
            "errors": [{"dst": dst.dict(), "error": str(ex)} for dst, ex in errors],
        })

    try:
        logger.info("MPU created: %s", mpu)
        yield mpu
    finally:
        try:
            await S3.get().abort_multipart_upload(**mpu.boto_args)
        except Exception:
            # XXX: send to sentry
            logger.exception("Error aborting MPU")


class ChecksumResult(pydantic.BaseModel):
    checksum: Checksum
    stats: T.Optional[dict] = None


# XXX: need a consistent way to serialize / deserialize exceptions
def lambda_wrapper(f):
    @functools.wraps(f)
    def wrapper(event, context):
        # XXX: make sure to disable in production to avoid leaking credentials
        logger.info("event: %s", event)
        logger.info("context: %s", context)
        try:
            result = asyncio.run(
                asyncio.wait_for(
                    f(**event),
                    context.get_remaining_time_in_millis() / 1000 - SECONDS_TO_CLEANUP,
                )
            )
            logger.info("result: %s", result)
            return {"result": result.dict()}
        except S3hashException as e:
            logger.exception("S3hashException")
            return {"error": e.dict()}
        except pydantic.ValidationError as e:
            # XXX: make it .info()?
            logger.exception("ValidationError")
            # TODO: expose advanced pydantic error reporting capabilities
            return {
                "error": {
                    "name": "InvalidInputParameters",
                    "context": {"details": str(e)},
                },
            }

    return wrapper


# XXX: move decorators to shared?
# XXX: move reusable types/models to shared?
@lambda_wrapper
@pydantic.validate_arguments
async def lambda_handler(
    *,
    credentials: AWSCredentials,
    location: S3ObjectSource,
    target: T.Optional[S3ObjectDestination] = None,
    concurrency: T.Optional[pydantic.PositiveInt] = None,
) -> ChecksumResult:
    if concurrency is None:
        concurrency = DEFAULT_CONCURRENCY

    logger.info(
        "arguments: %s",
        {
            "location": location,
            "target": target,
            "concurrency": concurrency,
        },
    )
    logger.info("MULTIPART_CHECKSUMS: %s", MULTIPART_CHECKSUMS)

    async with aio_context(credentials, concurrency):
        checksum = await get_existing_checksum(location)
        if checksum is not None:
            logger.info("got existing checksum")
            return ChecksumResult(checksum=checksum)

        part_defs = (
            await get_parts_for_location(location)
            if MULTIPART_CHECKSUMS
            else PARTS_SINGLE
        )

        logger.info("parts: %s", len(part_defs))

        async with create_mpu(location, target) as mpu:
            part_checksums, retry_stats = await compute_part_checksums(
                mpu,
                location,
                part_defs,
                concurrency,
            )

        logger.info("got checksums. retry stats: %s", retry_stats)

        checksum = Checksum.for_parts(part_checksums, part_defs)

        # TODO: expose perf (timing) stats
        stats = {"retry": retry_stats}
        return ChecksumResult(checksum=checksum, stats=stats)