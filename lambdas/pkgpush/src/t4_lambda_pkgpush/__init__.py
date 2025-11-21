from __future__ import annotations

import base64
import concurrent.futures
import contextlib
import functools
import json
import logging
import os
import re
import tempfile
import typing as T
import warnings

import boto3
import botocore.client
import botocore.credentials
import botocore.exceptions
import pydantic.v1
import rfc3986

# Must be done before importing quilt3.
os.environ["QUILT_DISABLE_CACHE"] = "true"  # noqa: E402
import quilt3
import quilt3.data_transfer
import quilt3.telemetry
import quilt3.util
import quilt3.workflows
from quilt3.backends import get_package_registry
from quilt3.backends.s3 import S3PackageRegistryV1
from quilt3.data_transfer import CHECKSUM_MAX_PARTS, get_checksum_chunksize, is_mpu
from quilt3.util import PhysicalKey
from quilt_shared.aws import AWSCredentials
from quilt_shared.const import LAMBDA_READ_TIMEOUT
from quilt_shared.lambdas_errors import LambdaError
from quilt_shared.lambdas_large_request_handler import (
    RequestTooLarge,
    large_request_handler,
)
from quilt_shared.pkgpush import (
    Checksum,
    ChecksumAlgorithm,
    ChecksumResult,
    CopyResult,
    PackageConstructEntry,
    PackageConstructParams,
    PackagePromoteParams,
    PackagePushResult,
    S3CopyLambdaParams,
    S3HashLambdaParams,
    S3ObjectDestination,
    S3ObjectSource,
    TopHash,
    make_scratch_key,
)

if T.TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client
    from mypy_boto3_s3.type_defs import HeadObjectOutputTypeDef

# XXX: use pydantic to manage settings
PROMOTE_PKG_MAX_MANIFEST_SIZE = int(os.environ["PROMOTE_PKG_MAX_MANIFEST_SIZE"])
PROMOTE_PKG_MAX_PKG_SIZE = int(os.environ["PROMOTE_PKG_MAX_PKG_SIZE"])
PROMOTE_PKG_MAX_FILES = int(os.environ["PROMOTE_PKG_MAX_FILES"])
MAX_BYTES_TO_HASH = int(os.environ["MAX_BYTES_TO_HASH"])
MAX_FILES_TO_HASH = int(os.environ["MAX_FILES_TO_HASH"])
# To dispatch separate, stack-created lambda functions.
S3_HASH_LAMBDA = os.environ["S3_HASH_LAMBDA"]
S3_COPY_LAMBDA = os.environ["S3_COPY_LAMBDA"]
# CFN template guarantees S3_HASH_LAMBDA_CONCURRENCY concurrent invocation of S3 hash lambda without throttling.
S3_HASH_LAMBDA_CONCURRENCY = int(os.environ["S3_HASH_LAMBDA_CONCURRENCY"])
S3_COPY_LAMBDA_CONCURRENCY = int(os.environ["S3_COPY_LAMBDA_CONCURRENCY"])
S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES = int(os.environ["S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES"])

SERVICE_BUCKET = os.environ["SERVICE_BUCKET"]

MAX_LAMBDA_FILE_DESCRIPTORS = 1_000
LOCAL_HASH_CONCURRENCY = MAX_LAMBDA_FILE_DESCRIPTORS - S3_HASH_LAMBDA_CONCURRENCY

logger = logging.getLogger("quilt-lambda-pkgpush")
logger.setLevel(os.environ.get("QUILT_LOG_LEVEL", "WARNING"))

s3 = boto3.client("s3")
lambda_ = boto3.client(
    "lambda",
    config=botocore.client.Config(
        read_timeout=LAMBDA_READ_TIMEOUT,
        # Prevent idle timeout on NAT gateway.
        tcp_keepalive=True,
        max_pool_connections=S3_HASH_LAMBDA_CONCURRENCY,
    ),
)


user_boto_session = None

# Isolated for test-ability.
get_user_boto_session = boto3.Session


@contextlib.contextmanager
def setup_user_boto_session(session: boto3.Session):
    global user_boto_session
    user_boto_session = session
    try:
        yield user_boto_session
    finally:
        user_boto_session = None


def _get_user_boto_session(*_, **__):
    assert user_boto_session is not None
    return user_boto_session


def get_user_boto_credentials():
    return AWSCredentials.from_boto_session(_get_user_boto_session())


def get_user_s3_client():
    return _get_user_boto_session().client(
        "s3",
        config=botocore.client.Config(max_pool_connections=LOCAL_HASH_CONCURRENCY),
    )


# Monkey patch quilt3 S3ClientProvider, so it builds a client using user credentials.
quilt3.data_transfer.S3ClientProvider.get_boto_session = staticmethod(_get_user_boto_session)


DEFAULT_CHECKSUM_ALGORITHMS = [
    ChecksumAlgorithm.SHA256_CHUNKED,
]


def format_checksum_algorithms(algorithms: list[ChecksumAlgorithm]) -> str:
    return ", ".join(a.name for a in algorithms)


@functools.cache
def get_checksum_algorithms():
    if var := os.environ.get("CHECKSUM_ALGORITHMS"):
        try:
            values = json.loads(var)
            if isinstance(values, list):
                algorithms: list[ChecksumAlgorithm] = []
                for v in values:
                    try:
                        algorithms.append(ChecksumAlgorithm.from_str(v))
                    except ValueError:
                        logger.warning(f"Invalid checksum algorithm ignored in CHECKSUM_ALGORITHMS: {v}")
                if algorithms:
                    return algorithms

        except json.decoder.JSONDecodeError:
            logger.warning(f"Failed to parse CHECKSUM_ALGORITHMS as JSON: {var}")

    logger.info(f"Using default checksum algorithms: {format_checksum_algorithms(DEFAULT_CHECKSUM_ALGORITHMS)}")
    return DEFAULT_CHECKSUM_ALGORITHMS


class PkgpushException(LambdaError):
    @classmethod
    def from_quilt_exception(cls, qe: quilt3.util.QuiltException):
        name = (
            "WorkflowValidationError" if isinstance(qe, quilt3.workflows.WorkflowValidationError) else "QuiltException"
        )
        return cls(name, {"details": qe.message})


def invoke_lambda(*, function_name: str, params: pydantic.v1.BaseModel, err_prefix: str):
    resp = lambda_.invoke(
        FunctionName=function_name,
        Payload=params.json(exclude_defaults=True),
    )

    parsed = json.load(resp["Payload"])

    if "FunctionError" in resp:
        raise PkgpushException(f"{err_prefix}UnhandledError", parsed)

    if "error" in parsed:
        raise PkgpushException(f"{err_prefix}Error", parsed["error"])

    return parsed["result"]


def try_get_crc64nvme_via_head(s3_client: S3Client, pk: PhysicalKey) -> Checksum | None:
    """
    Try to get precomputed CRC64NVME checksum using HeadObject with ChecksumMode=ENABLED.

    Note: Uses HeadObject instead of GetObjectAttributes because:
    - Cheaper API call
    - Uses s3:GetObject permission (no s3:GetObjectAttributes needed)
    - CRC64NVME has no chunked variant, so no compliance check needed
    """
    try:
        resp = s3_client.head_object(
            **S3ObjectSource.from_pk(pk).boto_args,
            ChecksumMode="ENABLED",
        )
        if checksum_value := resp.get(ChecksumAlgorithm.CRC64NVME.s3_checksum_field):
            return Checksum.from_s3_checksum(ChecksumAlgorithm.CRC64NVME, checksum_value)
        return None
    except botocore.exceptions.ClientError:
        return None


def try_get_compliant_sha256_chunked(s3_client: S3Client, pk: PhysicalKey, file_size: int) -> Checksum | None:
    """
    Try to get compliant SHA256_CHUNKED checksum using GetObjectAttributes.

    "Compliant" means the object's part sizes match our expected part size boundaries.
    This requires GetObjectAttributes to retrieve ObjectParts information.

    Note: This is more expensive than HeadObject and requires s3:GetObjectAttributes permission,
    but it's necessary to validate part size compliance for SHA256_CHUNKED.
    """
    try:
        # Small files should be handled by complete_entries_metadata() via HeadObject
        # Return early to avoid expensive GetObjectAttributes call
        if not is_mpu(file_size):
            return None

        resp = s3_client.get_object_attributes(
            **S3ObjectSource.from_pk(pk).boto_args,
            ObjectAttributes=["Checksum", "ObjectParts", "ObjectSize"],
            MaxParts=CHECKSUM_MAX_PARTS,
        )

        checksum_value = resp.get("Checksum", {}).get("ChecksumSHA256")
        if checksum_value is None:
            return None

        # Calculate expected part size (same logic as s3hash lambda)
        # We already checked is_mpu(file_size) above, so this is safe
        part_size = get_checksum_chunksize(file_size)

        object_parts = resp.get("ObjectParts")
        if object_parts is None:
            return None

        num_parts = object_parts.get("TotalPartsCount")
        assert num_parts, "S3 must return TotalPartsCount for multipart objects"
        parts = object_parts.get("Parts", [])

        # Make sure we have all parts
        if len(parts) != num_parts:
            return None

        # Check if part sizes match expected
        expected_num_parts, remainder = divmod(file_size, part_size)
        expected_part_sizes = [part_size] * expected_num_parts + ([remainder] if remainder else [])
        actual_part_sizes = [part.get("Size") for part in parts]

        if actual_part_sizes == expected_part_sizes:
            return Checksum.from_s3_checksum(ChecksumAlgorithm.SHA256_CHUNKED, checksum_value)

        return None
    except botocore.exceptions.ClientError:
        return None


def compute_checksum_via_copy(
    s3_client: S3Client,
    pk: PhysicalKey,
    scratch_buckets: dict[str, str],
    algorithm: ChecksumAlgorithm,
) -> Checksum:
    """Compute checksum for small file using copy_object with ChecksumAlgorithm."""
    region = get_bucket_region(pk.bucket)

    resp = s3_client.copy_object(
        CopySource=S3ObjectSource.from_pk(pk).boto_args,
        Bucket=scratch_buckets[region],
        Key=make_scratch_key(),
        ChecksumAlgorithm=algorithm.s3_checksum_algorithm,
    )
    checksum_value = resp["CopyObjectResult"].get(algorithm.s3_checksum_field)
    assert checksum_value
    return Checksum.from_s3_checksum(algorithm, checksum_value)


def invoke_hash_lambda(
    pk: PhysicalKey,
    credentials: AWSCredentials,
    scratch_buckets: dict[str, str],
    checksum_algorithm: ChecksumAlgorithm,
) -> Checksum:
    result = invoke_lambda(
        function_name=S3_HASH_LAMBDA,
        params=S3HashLambdaParams(
            credentials=credentials,
            scratch_buckets=scratch_buckets,
            location=S3ObjectSource.from_pk(pk),
            checksum_algorithm=checksum_algorithm,
        ),
        err_prefix="S3HashLambda",
    )
    checksum = ChecksumResult(**result).checksum
    return checksum


@functools.cache
def get_bucket_region(bucket: str) -> str:
    """
    Lookup the region for a given bucket.
    """
    try:
        resp = s3.head_bucket(Bucket=bucket)
    except botocore.exceptions.ClientError as e:
        resp = e.response
        if resp.get("Error", {}).get("Code") == "404":
            raise

    assert "ResponseMetadata" in resp
    return resp["ResponseMetadata"]["HTTPHeaders"]["x-amz-bucket-region"]


def try_get_precomputed_from_head(
    head_response: HeadObjectOutputTypeDef,
    file_size: int,
    checksum_algorithms: list[ChecksumAlgorithm],
) -> Checksum | None:
    """
    Try to extract precomputed checksum from HeadObject response in priority order.

    Args:
        head_response: Response from HeadObject with ChecksumMode=ENABLED
        file_size: Size of the file in bytes
        checksum_algorithms: Priority-ordered list of algorithms

    Returns:
        Checksum if found, None otherwise
    """
    for algorithm in checksum_algorithms:
        if checksum_value := head_response.get(algorithm.s3_checksum_field):
            if algorithm is ChecksumAlgorithm.SHA256_CHUNKED:
                # For small files with SHA256 FULL_OBJECT, compute sha2-256-chunked by double hashing.
                # This is much cheaper than copy_object (no data transfer, just local hash).
                # For large files, SHA256_CHUNKED needs GetObjectAttributes with part validation.
                if not is_mpu(file_size):
                    checksum_bytes = base64.b64decode(checksum_value)
                    return Checksum.sha256_chunked_from_parts([checksum_bytes])
                # Large file: skip for now, will be validated in calculate_pkg_hashes()
                continue

            return Checksum.from_s3_checksum(algorithm, checksum_value)
    return None


def calculate_pkg_hashes(
    pkg: quilt3.Package,
    scratch_buckets: dict[str, str],
    checksum_algorithms: list[ChecksumAlgorithm],
):
    """
    Calculate checksums for package entries using priority-based selection.

    Args:
        pkg: Package to calculate hashes for
        scratch_buckets: Scratch buckets for checksum computation
        checksum_algorithms: Priority-ordered list of algorithms

    Algorithm selection:
    1. For empty files: Use highest-priority algorithm's empty checksum
    2. For non-empty files: Check SHA256_CHUNKED compliance if needed
       (CRC64NVME already checked in complete_entries_metadata via HeadObject)
    3. If no precomputed: Compute using highest-priority algorithm
    """
    assert checksum_algorithms

    highest_priority_algorithm = checksum_algorithms[0]
    logger.info(f"[PERF] calculate_pkg_hashes START: {format_checksum_algorithms(checksum_algorithms)}")

    entries_to_hash = []
    for lk, entry in pkg.walk():
        if entry.hash is not None:
            continue
        assert isinstance(entry.size, int)

        # Safeguard: empty files should already have checksums from complete_entries_metadata()
        # but handle them here in case they weren't processed (e.g., size already known)
        if not entry.size:
            entry.hash = Checksum.get_empty(highest_priority_algorithm).dict()
        else:
            entries_to_hash.append(entry)

    logger.info(f"[PERF] Files needing checksums: {len(entries_to_hash)}")

    # Sort all entries by size descending to minimize tail latency
    entries_to_hash.sort(key=lambda entry: entry.size, reverse=True)

    credentials = get_user_boto_credentials()
    user_s3_client = get_user_s3_client()

    def try_get_precomputed(entry: quilt3.packages.PackageEntry):
        """
        Try to get precomputed checksum in priority order (doesn't compute).

        Note: CRC64NVME already checked in complete_entries_metadata() via HeadObject.
        Only need to check SHA256_CHUNKED compliance here (requires GetObjectAttributes).
        """
        pk = entry.physical_key

        # Check SHA256_CHUNKED compliance if it's in the priority list
        if ChecksumAlgorithm.SHA256_CHUNKED in checksum_algorithms:
            assert isinstance(entry.size, int)
            if checksum := try_get_compliant_sha256_chunked(user_s3_client, pk, entry.size):
                entry.hash = checksum.dict()
                return None

        # No precomputed checksum found
        return entry

    def compute_via_copy(entry: quilt3.packages.PackageEntry):
        """Compute checksum for small file via copy_object"""
        entry.hash = compute_checksum_via_copy(
            user_s3_client,
            entry.physical_key,
            scratch_buckets,
            highest_priority_algorithm,
        ).dict()

    def compute_via_s3hash(entry: quilt3.packages.PackageEntry):
        """Compute checksum for large file via s3hash lambda"""
        entry.hash = invoke_hash_lambda(
            entry.physical_key,
            credentials,
            scratch_buckets,
            highest_priority_algorithm,
        ).dict()

    with (
        concurrent.futures.ThreadPoolExecutor(max_workers=S3_HASH_LAMBDA_CONCURRENCY) as s3hash_pool,
        concurrent.futures.ThreadPoolExecutor(max_workers=LOCAL_HASH_CONCURRENCY) as local_pool,
    ):
        precomp_futures = [local_pool.submit(try_get_precomputed, e) for e in entries_to_hash]
        comp_futures = []
        for f in concurrent.futures.as_completed(precomp_futures):
            entry = f.result()
            if entry is None:
                continue

            # Decide computation method based on size
            assert isinstance(entry.size, int)
            if entry.size > S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES:
                raise PkgpushException(
                    "FileTooLargeForHashing",
                    {
                        "physical_key": str(entry.physical_key),
                        "size": entry.size,
                        "max_size": S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES,
                    },
                )

            comp_futures.append(
                s3hash_pool.submit(compute_via_s3hash, entry)
                if is_mpu(entry.size)
                else local_pool.submit(compute_via_copy, entry)
            )

        # Wait for all computations to complete
        concurrent.futures.wait(comp_futures)

    # Summary
    precomputed = len(entries_to_hash) - len(comp_futures)
    computed = len(comp_futures)
    logger.info(f"[PERF] calculate_pkg_hashes END: {precomputed} precomputed, {computed} computed")


def invoke_copy_lambda(
    credentials: AWSCredentials,
    src: PhysicalKey,
    dst: PhysicalKey,
    checksum_algorithm: ChecksumAlgorithm,
) -> str | None:
    result = invoke_lambda(
        function_name=S3_COPY_LAMBDA,
        params=S3CopyLambdaParams(
            credentials=credentials,
            location=S3ObjectSource.from_pk(src),
            target=S3ObjectDestination.from_pk(dst),
            checksum_algorithm=checksum_algorithm,
        ),
        err_prefix="S3CopyLambda",
    )
    return CopyResult(**result).version


def copy_pkg_entry_data(
    credentials: AWSCredentials,
    src: PhysicalKey,
    dst: PhysicalKey,
    idx: int,
    checksum_algorithm: ChecksumAlgorithm,
) -> tuple[int, tuple[PhysicalKey, str | None]]:
    version_id = invoke_copy_lambda(credentials, src, dst, checksum_algorithm)
    versioned_key = PhysicalKey(bucket=dst.bucket, path=dst.path, version_id=version_id)
    # Return tuple of (versioned_key, checksum) - checksum is None since we don't compute it during copy
    return idx, (versioned_key, None)


def copy_file_list(checksum_algorithm: ChecksumAlgorithm):
    def _copy_file_list(
        file_list: list[tuple[PhysicalKey, PhysicalKey, int]],
        message=None,
        callback=None,
    ) -> list[tuple[PhysicalKey, str | None]]:
        logger.info(f"[PERF] copy_file_list START: {len(file_list)} files, algorithm={checksum_algorithm.name}")
        # TODO: Copy single part files directly, because using lambda for that just adds overhead,
        #       this can be done is a separate thread pool providing higher concurrency.
        # TODO: Use checksums to deduplicate?
        # Schedule longer tasks first so we don't end up waiting for a single long task.
        file_list_enumerated = list(enumerate(file_list))
        file_list_enumerated.sort(key=lambda x: x[1][2], reverse=True)

        with concurrent.futures.ThreadPoolExecutor(max_workers=S3_COPY_LAMBDA_CONCURRENCY) as pool:
            credentials = get_user_boto_credentials()
            fs = [
                pool.submit(copy_pkg_entry_data, credentials, src, dst, idx, checksum_algorithm)
                for idx, (src, dst, _) in file_list_enumerated
            ]
            results = [f.result() for f in concurrent.futures.as_completed(fs)]
            # Sort by idx to restore original order.
            results.sort(key=lambda x: x[0])

        logger.info(f"[PERF] copy_file_list END: {len(file_list)} files")
        return [x[1] for x in results]

    return _copy_file_list


class Event(pydantic.v1.BaseModel):
    credentials: AWSCredentials
    params: T.Any


def auth(f):
    @functools.wraps(f)
    @pydantic.v1.validate_arguments
    def wrapper(event: Event):
        with setup_user_boto_session(get_user_boto_session(**event.credentials.boto_args)):
            return f(event.params)

    return wrapper


def exception_handler(f):
    @functools.wraps(f)
    def wrapper(event, context):
        try:
            result = f(event)
            return {"result": result.dict()}
        except RequestTooLarge as e:
            logger.exception("RequestTooLarge")
            return {
                "error": {
                    "name": "RequestTooLarge",
                    "context": {
                        "size": e.size,
                        "max_size": e.max_size,
                    },
                }
            }
        except PkgpushException as e:
            logger.exception("PkgpushException")
            return {"error": e.dict()}
        except pydantic.v1.ValidationError as e:
            # XXX: make it .info()?
            logger.exception("ValidationError")
            # XXX: expose advanced pydantic error reporting capabilities?
            return {
                "error": {
                    "name": "InvalidInputParameters",
                    "context": {"details": str(e)},
                },
            }

    return wrapper


def setup_telemetry(f):
    @functools.wraps(f)
    def wrapper(params):
        try:
            return f(params)
        finally:
            # A single instance of lambda can process several requests,
            # generate new session ID for each request.
            quilt3.telemetry.reset_session_id()

    return wrapper


def get_registry(registry_url: str):
    package_registry = None
    try:
        package_registry = get_package_registry(registry_url)
    except quilt3.util.URLParseError:
        pass
    else:
        if not isinstance(package_registry, S3PackageRegistryV1):
            package_registry = None
    if package_registry is None:
        raise PkgpushException("InvalidRegistry", {"registry_url": registry_url})
    return package_registry


def _get_successor_params(
    registry: S3PackageRegistryV1,
    successor: S3PackageRegistryV1,
) -> dict[str, T.Any]:
    workflow_config = registry.get_workflow_config()
    assert workflow_config
    successors = workflow_config.config.get("successors") or {}
    for successor_url, successor_params in successors.items():
        if get_registry(successor_url) == successor:
            return successor_params
    raise PkgpushException("InvalidSuccessor", {"successor": str(successor.base)})


def _push_pkg_to_successor(
    params: PackagePromoteParams,
    *,
    src_bucket: str,
    get_pkg: T.Callable[[S3PackageRegistryV1], quilt3.Package],
    pkg_max_size: int,
    pkg_max_files: int,
    checksum_algorithm: ChecksumAlgorithm,
) -> PackagePushResult:
    dst_registry_url = f"s3://{params.bucket}"
    dst_registry = get_registry(dst_registry_url)
    src_registry = get_registry(f"s3://{src_bucket}")
    successor_params = _get_successor_params(src_registry, dst_registry)
    copy_data: bool = successor_params.get("copy_data", True)

    try:
        pkg = get_pkg(src_registry)
        if copy_data:
            total_size = 0
            total_files = 0
            for lk, e in pkg.walk():
                assert isinstance(e.size, int)
                total_size += e.size
                if total_size > pkg_max_size:
                    raise PkgpushException(
                        "PackageTooLargeToCopy",
                        {"size": total_size, "max_size": pkg_max_size},
                    )
                total_files += 1
                if total_files > pkg_max_files:
                    raise PkgpushException(
                        "TooManyFilesToCopy",
                        {"num_files": total_files, "max_files": pkg_max_files},
                    )

        if params.user_meta is None:
            pkg._meta.pop("user_meta", None)
        else:
            pkg.set_meta(params.user_meta)

        dest = None
        if copy_data and params.dest_prefix is not None:
            dest = f"{dst_registry_url}/{params.dest_prefix}/{params.name}"

        # We use _push() instead of push() for print_info=False
        # to prevent unneeded ListObjects calls during generation of
        # shortened revision hash.
        result = pkg._push(
            name=params.name,
            registry=dst_registry_url,
            message=params.message,
            workflow=params.workflow_normalized,
            selector_fn=None if copy_data else lambda *_: False,
            print_info=False,
            dedupe=False,
            dest=dest,
            # TODO: we use force=True to keep the existing behavior,
            #       but it should be re-considered.
            force=True,
            copy_file_list_fn=copy_file_list(checksum_algorithm),
        )
        assert result._origin is not None
        return PackagePushResult(top_hash=result._origin.top_hash)
    except quilt3.util.QuiltException as qe:
        raise PkgpushException.from_quilt_exception(qe)
    except botocore.exceptions.ClientError as boto_error:
        raise PkgpushException.from_boto_error(boto_error)
    except quilt3.data_transfer.S3NoValidClientError as e:
        raise PkgpushException("Forbidden", {"details": e.message})


def entry_needs_metadata(entry: quilt3.packages.PackageEntry):
    return entry.physical_key.version_id is None or entry.size is None or entry.hash is None


def complete_entries_metadata(
    pkg_entries: dict[str, quilt3.packages.PackageEntry],
    checksum_algorithms: list[ChecksumAlgorithm],
):
    """
    Fetch missing metadata and precomputed checksums concurrently.
    Mutate `PackageEntry`s in place.
    """

    entries_need_metadata = [lk for lk, entry in pkg_entries.items() if entry_needs_metadata(entry)]
    if not entries_need_metadata:
        return

    user_s3_client = get_user_s3_client()

    def _fetch_and_update_single(logical_key: str):
        pkg_entry = pkg_entries[logical_key]
        pk = pkg_entry.physical_key

        try:
            head_params = {
                "Bucket": pk.bucket,
                "Key": pk.path,
                "ChecksumMode": "ENABLED",
            }
            if pk.version_id:
                head_params["VersionId"] = pk.version_id

            resp = user_s3_client.head_object(**head_params)

            # Update physical_key with version_id if missing
            if pk.version_id is None:
                pkg_entry.physical_key = PhysicalKey(
                    pk.bucket,
                    pk.path,
                    resp.get("VersionId"),
                )

            # Update size
            pkg_entry.size = resp["ContentLength"]

            # Set hash for empty files immediately (use highest-priority algorithm)
            if pkg_entry.hash is None and pkg_entry.size == 0:
                highest_priority_algorithm = checksum_algorithms[0]
                pkg_entry.hash = Checksum.get_empty(highest_priority_algorithm).dict()

            # Try to get precomputed checksum from HEAD response (priority order)
            if pkg_entry.hash is None:
                if checksum := try_get_precomputed_from_head(resp, pkg_entry.size, checksum_algorithms):
                    pkg_entry.hash = checksum.dict()
        except botocore.exceptions.ClientError as e:
            raise PkgpushException(
                "FailedToFetchObjectMetadata",
                {
                    "logical_key": logical_key,
                    "physical_key": str(pk),
                    "error": str(e),
                },
            )

    logger.info(f"[PERF] complete_entries_metadata: Fetching metadata for {len(entries_need_metadata)} objects")
    with concurrent.futures.ThreadPoolExecutor(max_workers=LOCAL_HASH_CONCURRENCY) as pool:
        futures = [pool.submit(_fetch_and_update_single, lk) for lk in entries_need_metadata]
        # Check for exceptions
        for f in concurrent.futures.as_completed(futures):
            f.result()  # Raises exception if any occurred

    # Count results
    checksums_found = sum(1 for lk in entries_need_metadata if pkg_entries[lk].hash is not None)
    logger.info(
        f"[PERF] complete_entries_metadata: Found {checksums_found}/{len(entries_need_metadata)} precomputed checksums"
    )


@exception_handler
@auth
@setup_telemetry
@pydantic.v1.validate_arguments
def promote_package(params: PackagePromoteParams) -> PackagePushResult:
    logger.info(f"[PERF] promote_package START: {params.src.bucket}/{params.src.name} -> {params.bucket}")
    checksum_algorithm = get_checksum_algorithms()[0]
    logger.info(f"[PERF] Using checksum algorithm: {checksum_algorithm.name}")

    def get_pkg(src_registry: S3PackageRegistryV1):
        quilt3.util.validate_package_name(params.src.name)

        manifest_pk = src_registry.manifest_pk(params.src.name, params.src.hash)
        manifest_size, version = quilt3.data_transfer.get_size_and_version(manifest_pk)
        if manifest_size > PROMOTE_PKG_MAX_MANIFEST_SIZE:
            raise PkgpushException(
                "ManifestTooLarge",
                {
                    "size": manifest_size,
                    "max_size": PROMOTE_PKG_MAX_MANIFEST_SIZE,
                },
            )

        manifest_pk = PhysicalKey(manifest_pk.bucket, manifest_pk.path, version)

        # TODO: it's better to use TemporaryFile() here, but we don't have API
        #       for downloading to fileobj.
        with tempfile.NamedTemporaryFile() as tmp_file:
            quilt3.data_transfer.copy_file(
                manifest_pk,
                PhysicalKey.from_path(tmp_file.name),
                size=manifest_size,
            )
            pkg = quilt3.Package.load(tmp_file)

        if any(e.physical_key.is_local() for lk, e in pkg.walk()):
            raise PkgpushException("ManifestHasLocalKeys")

        return pkg

    result = _push_pkg_to_successor(
        params,
        src_bucket=params.src.bucket,
        get_pkg=get_pkg,
        pkg_max_size=PROMOTE_PKG_MAX_PKG_SIZE,
        pkg_max_files=PROMOTE_PKG_MAX_FILES,
        checksum_algorithm=checksum_algorithm,
    )
    logger.info(f"[PERF] promote_package END: top_hash={result.top_hash}")
    return result


@exception_handler
@auth
@setup_telemetry
@large_request_handler(
    request_type="create-package",
    bucket=SERVICE_BUCKET,
    s3=s3,
    logger=logger,
)
def create_package(req_file: T.IO[bytes]) -> PackagePushResult:
    params = PackageConstructParams.parse_raw(next(req_file))
    checksum_algorithms = get_checksum_algorithms()
    logger.info(f"[PERF] create_package START: {params.bucket}/{params.name}")
    logger.info(f"[PERF] Using checksum algorithms: {format_checksum_algorithms(checksum_algorithms)}")

    registry_url = f"s3://{params.bucket}"
    try:
        package_registry = get_registry(registry_url)

        quilt3.util.validate_package_name(params.name)
        pkg = quilt3.Package()
        if params.user_meta is not None:
            pkg.set_meta(params.user_meta)

        # Phase 1: Parse entries and create PackageEntry objects (store temporarily)
        logger.info("[PERF] Parsing entries and creating PackageEntry objects")
        pkg_entries: dict[str, quilt3.packages.PackageEntry] = {}

        for line in req_file:
            entry = PackageConstructEntry.parse_raw(line)

            try:
                physical_key = PhysicalKey.from_url(entry.physical_key)
            except ValueError:
                raise PkgpushException(
                    "InvalidS3PhysicalKey",
                    {"physical_key": entry.physical_key},
                )
            if physical_key.is_local():
                raise PkgpushException(
                    "InvalidLocalPhysicalKey",
                    {"physical_key": str(physical_key)},
                )

            # Create PackageEntry (may need metadata later)
            pkg_entries[entry.logical_key] = quilt3.packages.PackageEntry(
                physical_key,
                entry.size,  # May be None - will fetch via HEAD
                entry.hash.dict() if entry.hash else None,
                entry.meta,
            )

        logger.info(f"[PERF] Created {len(pkg_entries)} PackageEntry objects")

        # Phase 2: Fetch missing metadata and precomputed checksums concurrently
        complete_entries_metadata(pkg_entries, checksum_algorithms)

        # Phase 3: Add fully-prepared entries to package and validate limits
        logger.info("[PERF] Adding entries to package and validating limits")
        size_to_hash = 0
        files_to_hash = 0
        for logical_key, pkg_entry in pkg_entries.items():
            assert isinstance(pkg_entry.size, int), f"Size must be available after HEAD requests: {logical_key}"
            pkg.set(logical_key, pkg_entry)

            if pkg_entry.hash is None:
                size_to_hash += pkg_entry.size
                files_to_hash += 1

            if size_to_hash > MAX_BYTES_TO_HASH:
                raise PkgpushException(
                    "PackageTooLargeToHash",
                    {
                        "size": size_to_hash,
                        "max_size": MAX_BYTES_TO_HASH,
                    },
                )

            if files_to_hash > MAX_FILES_TO_HASH:
                raise PkgpushException(
                    "TooManyFilesToHash",
                    {
                        "num_files": files_to_hash,
                        "max_files": MAX_FILES_TO_HASH,
                    },
                )

        logger.info("[PERF] Validating workflow")
        pkg._validate_with_workflow(
            registry=package_registry,
            workflow=params.workflow_normalized,
            name=params.name,
            message=params.message,
        )

    except quilt3.util.QuiltException as qe:
        raise PkgpushException.from_quilt_exception(qe)

    calculate_pkg_hashes(pkg, params.scratch_buckets, checksum_algorithms)

    try:
        logger.info("[PERF] pkg._build START")
        top_hash = pkg._build(
            name=params.name,
            registry=registry_url,
            message=params.message,
        )
        logger.info(f"[PERF] pkg._build END: top_hash={top_hash}")
    except botocore.exceptions.ClientError as boto_error:
        raise PkgpushException.from_boto_error(boto_error)

    # XXX: return mtime?
    logger.info(f"[PERF] create_package END: {params.bucket}/{params.name}")
    return PackagePushResult(top_hash=TopHash(top_hash))


class PackagerEvent(pydantic.v1.BaseModel):
    source_prefix: str
    registry: str | None = None
    package_name: str | None = None
    metadata: dict[str, T.Any] | None = None
    metadata_uri: str | None = None
    workflow: str | None = None
    commit_message: str | None = None

    @pydantic.v1.root_validator
    def validate_metadata(cls, values):
        metadata, metadata_uri = values["metadata"], values["metadata_uri"]
        if metadata is not None and metadata_uri is not None:
            raise ValueError("metadata and metadata_uri are mutually exclusive")
        return values

    def get_source_prefix_pk(self) -> PhysicalKey:
        pk = PhysicalKey.from_url(self.source_prefix)
        if pk.is_local():
            raise PkgpushException("InvalidLocalPhysicalKey", {"physical_key": str(pk)})
        return PhysicalKey(
            pk.bucket,
            pk.path if pk.path.endswith("/") or not pk.path else pk.path.rsplit("/", 1)[0] + "/",
            None,
        )

    def get_metadata_uri_pk(self) -> PhysicalKey | None:
        if self.metadata_uri is None:
            return None
        pk = PhysicalKey.from_url(rfc3986.uri_reference(self.metadata_uri).resolve_with(self.source_prefix).unsplit())
        if pk.is_local():
            raise PkgpushException("InvalidLocalPhysicalKey", {"physical_key": str(pk)})
        return pk

    @property
    def workflow_normalized(self):
        # use default
        if self.workflow is None:
            return ...

        # not selected
        if self.workflow == "":
            return None

        return self.workflow


def infer_pkg_name_from_prefix(prefix: str) -> str:
    default_prefix = "package"
    default_suffix = "null"

    parts = [re.sub(r"[^\w-]", "-", p) for p in prefix.split("/") if p]
    parts = ["_".join(parts[:-1]) or default_prefix, parts[-1] if parts else default_suffix]
    return "/".join(parts)


def get_scratch_buckets() -> dict[str, str]:
    return json.load(s3.get_object(Bucket=SERVICE_BUCKET, Key="scratch-buckets.json")["Body"])


def package_prefix_sqs(event, context):
    import pprint

    pprint.pprint(event)

    if len(event["Records"]) != 1:
        raise PkgpushException(
            "InvalidNumberOfRecords",
            {
                "details": "This lambda can only process one record at a time",
                "records_received": len(event["Records"]),
            },
        )

    with setup_user_boto_session(get_user_boto_session()):
        for record in event["Records"]:
            package_prefix(record["body"], context)


def list_prefix_latest_versions(bucket: str, prefix: str):
    paginator = s3.get_paginator("list_object_versions")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Versions", []):
            if not obj.get("IsLatest"):
                continue
            key = obj.get("Key")
            assert isinstance(key, str)
            if key.endswith("/"):
                if obj.get("Size") != 0:
                    warnings.warn(f'Logical keys cannot end in "/", skipping: {key}')
                continue
            yield obj


def package_prefix(event, context):
    params = PackagerEvent.parse_raw(event)
    checksum_algorithms = get_checksum_algorithms()
    logger.info(f"[PERF] package_prefix START: {params.source_prefix}")
    logger.info(f"[PERF] Using checksum algorithms: {format_checksum_algorithms(checksum_algorithms)}")

    prefix_pk = params.get_source_prefix_pk()

    pkg_name = infer_pkg_name_from_prefix(prefix_pk.path) if params.package_name is None else params.package_name

    dst_bucket = params.registry or prefix_pk.bucket
    registry_url = f"s3://{dst_bucket}"
    package_registry = get_package_registry(registry_url)

    metadata = params.metadata
    if metadata_uri_pk := params.get_metadata_uri_pk():
        metadata = json.load(s3.get_object(**S3ObjectSource.from_pk(metadata_uri_pk).boto_args)["Body"])
        if not isinstance(metadata, dict):
            raise PkgpushException("InvalidMetadata", {"details": "Metadata must be a JSON object"})

    prefix_len = len(prefix_pk.path)

    pkg_entries: dict[str, quilt3.packages.PackageEntry] = {}

    for obj in list_prefix_latest_versions(prefix_pk.bucket, prefix_pk.path):
        key = obj.get("Key")
        assert key is not None
        size = obj.get("Size")
        assert size is not None
        logical_key = key[prefix_len:]
        pkg_entries[logical_key] = quilt3.packages.PackageEntry(
            PhysicalKey(prefix_pk.bucket, key, obj.get("VersionId")),
            size,
            None,
            None,
        )

    # Fetch missing metadata and precomputed checksums concurrently
    complete_entries_metadata(pkg_entries, checksum_algorithms)

    pkg = quilt3.Package()

    for logical_key, pkg_entry in pkg_entries.items():
        pkg.set(logical_key, pkg_entry)

    pkg.set_meta(metadata)
    pkg._validate_with_workflow(
        registry=package_registry,
        workflow=params.workflow_normalized,
        name=pkg_name,
        message=params.commit_message,
    )
    calculate_pkg_hashes(pkg, get_scratch_buckets(), checksum_algorithms)
    top_hash = pkg._build(
        name=pkg_name,
        registry=registry_url,
        message=params.commit_message,
    )
    logger.info(f"[PERF] package_prefix END: {pkg_name} top_hash={top_hash}")
