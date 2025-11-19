from __future__ import annotations

import asyncio
import base64
import contextlib
import contextvars
import functools
import logging
import math
import os
import typing as T

import aiobotocore.config
import aiobotocore.response
import aiobotocore.session
import botocore.exceptions
import pydantic.v1

from quilt_shared.aws import AWSCredentials
from quilt_shared.const import MAX_PARTS, MIN_PART_SIZE
from quilt_shared.lambdas_errors import LambdaError
from quilt_shared.pkgpush import (
    Checksum,
    ChecksumAlgorithm,
    ChecksumResult,
    CopyResult,
    MPURef as MPURefBase,
    S3ObjectDestination,
    S3ObjectSource,
    make_scratch_key,
)

if T.TYPE_CHECKING:
    from types_aiobotocore_s3.client import S3Client
    from types_aiobotocore_s3.type_defs import CompletedPartTypeDef


logger = logging.getLogger("quilt-lambda-s3hash")
logger.setLevel(os.environ.get("QUILT_LOG_LEVEL", "WARNING"))

MPU_CONCURRENCY = int(os.environ["MPU_CONCURRENCY"])

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


# XXX: import this logic from quilt3 when it's available
def get_part_size(file_size: int) -> T.Optional[int]:
    # XXX: do we need this?
    if not 0 <= file_size <= 5 * 2**40:
        raise ValueError("size must be non-negative and less than 5 TiB")

    if file_size < MIN_PART_SIZE:
        return None  # use single-part (compute via copy_object)

    # NOTE: in the case where file_size is exactly equal to MIN_PART_SIZE,
    # boto creates a 1-part multipart upload :shrug:
    part_size = MIN_PART_SIZE
    while math.ceil(file_size / part_size) > MAX_PARTS:
        part_size *= 2

    return part_size


async def get_bucket_region(bucket: str) -> str:
    """
    Lookup the region for a given bucket.
    """
    try:
        resp = await S3.get().head_bucket(Bucket=bucket)
    except botocore.exceptions.ClientError as e:
        resp = e.response
        if resp.get("Error", {}).get("Code") == "404":
            raise

    assert "ResponseMetadata" in resp
    return resp["ResponseMetadata"]["HTTPHeaders"]["x-amz-bucket-region"]


async def get_mpu_dst_for_location(location: S3ObjectSource, scratch_buckets: T.Dict[str, str]) -> S3ObjectDestination:
    region = await get_bucket_region(location.bucket)
    scratch_bucket = scratch_buckets.get(region)
    if scratch_bucket is None:
        raise LambdaError(
            "ScratchBucketNotFound",
            {"region": region, "bucket": location.bucket, "scratch_buckets": scratch_buckets},
        )

    return S3ObjectDestination(bucket=scratch_bucket, key=make_scratch_key())


class PartSourceDef(T.TypedDict):
    PartNumber: int
    CopySourceRange: T.NotRequired[str]


class PartDef(pydantic.v1.BaseModel):
    part_number: int
    range: T.Optional[T.Tuple[int, int]]

    @property
    def size(self) -> int:
        """Get the size of this part in bytes."""
        if self.range is None:
            raise ValueError("Cannot get size of single-part upload without range")
        return self.range[1] - self.range[0] + 1

    @property
    def boto_args(self) -> PartSourceDef:
        args = PartSourceDef(PartNumber=self.part_number)
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


async def upload_part(
    mpu: MPURef,
    src: S3ObjectSource,
    etag: str,
    part: PartDef,
    algorithm: ChecksumAlgorithm,
) -> PartUploadResult:
    res = await S3.get().upload_part_copy(
        **mpu.boto_args,
        **part.boto_args,
        CopySource=src.boto_args,
        # In case we don't have version ID (e.g. non-versioned bucket)
        # we have to use ETag to make sure object is not modified during copy,
        # otherwise we can end up with invalid checksum.
        CopySourceIfMatch=etag,
    )
    copy_result = res["CopyPartResult"]
    assert "ETag" in copy_result

    # Extract checksum from response
    checksum_value = copy_result.get(algorithm.s3_checksum_field)
    assert isinstance(checksum_value, str)

    return PartUploadResult(
        etag=copy_result["ETag"],
        checksum=checksum_value,
        algorithm=algorithm,
    )


async def upload_parts(
    mpu: MPURef,
    location: S3ObjectSource,
    etag: str,
    parts: T.Sequence[PartDef],
    algorithm: ChecksumAlgorithm,
) -> T.List[PartUploadResult]:
    s = asyncio.Semaphore(MPU_CONCURRENCY)

    async def _upload_part(*args, **kwargs):
        async with s:
            return await upload_part(*args, **kwargs)

    uploads = [_upload_part(mpu, location, etag, p, algorithm) for p in parts]
    return await asyncio.gather(*uploads)


async def compute_part_checksums(
    mpu: MPURef,
    location: S3ObjectSource,
    etag: str,
    parts: T.Sequence[PartDef],
    algorithm: ChecksumAlgorithm,
) -> T.List[bytes]:
    logger.info(f"[PERF] compute_part_checksums START: {len(parts)} parts for {location} algorithm={algorithm}")
    part_upload_results = await upload_parts(
        mpu,
        location,
        etag,
        parts,
        algorithm,
    )
    checksums = [base64.b64decode(part_upload_result.checksum) for part_upload_result in part_upload_results]
    logger.info(f"[PERF] compute_part_checksums END: {len(parts)} parts")
    return checksums


class PartUploadResult(pydantic.v1.BaseModel):
    etag: str
    checksum: str  # base64-encoded checksum value
    algorithm: ChecksumAlgorithm

    def boto_args_completed(self, part_number: int) -> CompletedPartTypeDef:
        a: CompletedPartTypeDef = {
            "PartNumber": part_number,
            "ETag": self.etag,
        }
        a[self.algorithm.s3_checksum_field] = self.checksum
        return a


class MPURef(MPURefBase):
    _completed: bool = pydantic.v1.PrivateAttr(default=False)

    @property
    def completed(self):
        return self._completed

    async def complete(self, parts: T.Sequence[PartUploadResult]):
        if self.completed:
            # XXX: better exception type
            raise Exception("MPU is already completed.")

        result = await S3.get().complete_multipart_upload(
            **self.boto_args,
            MultipartUpload={
                "Parts": [part.boto_args_completed(n) for n, part in enumerate(parts, 1)],
            },
        )
        self._completed = True
        return result

    async def abort(self):
        if not self.completed:
            await S3.get().abort_multipart_upload(**self.boto_args)


@contextlib.asynccontextmanager
async def create_mpu(target: S3ObjectDestination, algorithm: ChecksumAlgorithm):
    """Create multipart upload with checksum algorithm."""
    try:
        upload_data = await S3.get().create_multipart_upload(
            **target.boto_args,
            ChecksumAlgorithm=algorithm.s3_checksum_algorithm,
        )
        mpu = MPURef(bucket=target.bucket, key=target.key, id=upload_data["UploadId"])
    except botocore.exceptions.ClientError as ex:
        raise LambdaError("MPUError", {"dst": target.dict(), "error": str(ex)})

    try:
        yield mpu
    finally:
        try:
            await mpu.abort()
        except Exception:
            # XXX: send to sentry
            logger.exception("Error aborting MPU")


AnyDict = T.Dict[str, T.Any]
LambdaContext = T.Any


# XXX: need a consistent way to serialize / deserialize exceptions
def lambda_wrapper(f) -> T.Callable[[AnyDict, LambdaContext], AnyDict]:
    @functools.wraps(f)
    def wrapper(event: AnyDict, context: LambdaContext) -> AnyDict:
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
            except pydantic.v1.ValidationError as e:
                # XXX: make it .info()?
                logger.exception("ValidationError")
                # TODO: expose advanced pydantic error reporting capabilities
                raise LambdaError("InvalidInputParameters", {"details": str(e)})
            return {"result": result.dict()}
        except LambdaError as e:
            logger.exception("LambdaError")
            return {"error": e.dict()}

    return wrapper


async def compute_checksum(
    location: S3ObjectSource,
    scratch_buckets: T.Dict[str, str],
    algorithm: ChecksumAlgorithm,
) -> ChecksumResult:
    logger.info(f"[PERF] compute_checksum START: {location} algorithm={algorithm}")

    # Get object metadata
    resp = await S3.get().head_object(**location.boto_args)
    etag, total_size = resp["ETag"], resp["ContentLength"]

    # Handle empty files
    if total_size == 0:
        logger.info(f"[PERF] compute_checksum END: Empty file for {location}")
        return ChecksumResult(checksum=Checksum.get_empty(algorithm))

    # Compute checksum via scratch bucket MPU
    logger.info(f"[PERF] Computing checksum via MPU for {location} (size={total_size} algorithm={algorithm})")
    part_defs = get_parts_for_size(total_size)
    mpu_dst = await get_mpu_dst_for_location(location, scratch_buckets)

    async with create_mpu(mpu_dst, algorithm) as mpu:
        part_checksums = await compute_part_checksums(
            mpu,
            location,
            etag,
            part_defs,
            algorithm,
        )

    # Combine per-part checksums into whole-file checksum
    if algorithm == ChecksumAlgorithm.CRC64NVME:
        if len(part_checksums) == 1:
            logger.info(f"[PERF] Single-part CRC64NVME checksum for {location}")
            checksum = Checksum.crc64nvme(part_checksums[0])
        else:
            part_sizes = [part_def.size for part_def in part_defs]
            logger.info(f"[PERF] Combined {len(part_checksums)} part CRC64NVME checksums for {location}")
            checksum = Checksum.crc64nvme_from_parts(part_checksums, part_sizes)
    elif algorithm == ChecksumAlgorithm.SHA256_CHUNKED:
        if len(part_checksums) == 1:
            logger.info(f"[PERF] Single-part SHA256 checksum for {location}")
            checksum = Checksum.sha256_chunked(part_checksums[0])
        else:
            logger.info(f"[PERF] Combined {len(part_checksums)} part SHA256 checksums for {location}")
            checksum = Checksum.sha256_chunked_from_parts(part_checksums)

    logger.info(f"[PERF] compute_checksum END: {location} -> {checksum.type}")
    return ChecksumResult(checksum=checksum)


# XXX: move decorators to shared?
@lambda_wrapper
@pydantic.v1.validate_arguments
async def lambda_handler(
    *,
    credentials: AWSCredentials,
    scratch_buckets: T.Dict[str, str],
    location: S3ObjectSource,
    checksum_algorithm: ChecksumAlgorithm = ChecksumAlgorithm.SHA256_CHUNKED,
) -> ChecksumResult:
    logger.info(f"[PERF] lambda_handler START: {location} algorithm={checksum_algorithm}")
    async with aio_context(credentials):
        result = await compute_checksum(location, scratch_buckets, checksum_algorithm)
    logger.info(f"[PERF] lambda_handler END: {location} -> {result.checksum.type}")
    return result


async def copy(
    location: S3ObjectSource,
    target: S3ObjectDestination,
    checksum_algorithm: ChecksumAlgorithm = ChecksumAlgorithm.CRC64NVME,
) -> CopyResult:
    resp = await S3.get().head_object(**location.boto_args)
    etag, total_size = resp["ETag"], resp["ContentLength"]

    part_defs = get_parts_for_size(total_size)
    if part_defs == PARTS_SINGLE:
        logger.warning("Consider using copy_object() directly instead of invoking this lambda.")
        # FIXME: pass checksum algorithm
        resp = await S3.get().copy_object(
            **target.boto_args,
            CopySource=location.boto_args,
            CopySourceIfMatch=etag,
        )
        return CopyResult(version=resp.get("VersionId"))

    async with create_mpu(target, checksum_algorithm) as mpu:
        part_upload_results = await upload_parts(mpu, location, etag, part_defs, checksum_algorithm)
        resp = await mpu.complete(part_upload_results)
        return CopyResult(version=resp.get("VersionId"))


# XXX: move decorators to shared?
@lambda_wrapper
@pydantic.v1.validate_arguments
async def lambda_handler_copy(
    *,
    credentials: AWSCredentials,
    location: S3ObjectSource,
    target: S3ObjectDestination,
) -> CopyResult:
    async with aio_context(credentials):
        return await copy(location, target)
