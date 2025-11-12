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
from quilt3.util import PhysicalKey
from quilt_shared.aws import AWSCredentials
from quilt_shared.const import LAMBDA_READ_TIMEOUT, MIN_PART_SIZE
from quilt_shared.lambdas_errors import LambdaError
from quilt_shared.lambdas_large_request_handler import (
    RequestTooLarge,
    large_request_handler,
)
from quilt_shared.pkgpush import (
    Checksum,
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

# Priority-ordered list of acceptable checksum algorithms (default for backward compatibility)
# Only SHA256_CHUNKED and CRC64NVME are supported (legacy SHA256 dropped)
DEFAULT_CHECKSUM_ALGORITHMS = ["SHA256_CHUNKED"]
CHECKSUM_ALGORITHMS = json.loads(os.environ.get("CHECKSUM_ALGORITHMS", json.dumps(DEFAULT_CHECKSUM_ALGORITHMS)))

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


# Monkey patch quilt3 S3ClientProvider, so it builds a client using user credentials.
user_boto_session = None
quilt3.data_transfer.S3ClientProvider.get_boto_session = staticmethod(lambda: user_boto_session)


class PkgpushException(LambdaError):
    @classmethod
    def from_quilt_exception(cls, qe: quilt3.util.QuiltException):
        name = (
            "WorkflowValidationError"
            if isinstance(qe, quilt3.workflows.WorkflowValidationError)
            else "QuiltException"
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


def get_empty_checksum(algorithm: str) -> Checksum:
    """Get empty checksum for a given algorithm (only SHA256_CHUNKED and CRC64NVME supported)."""
    if algorithm == "CRC64NVME":
        return Checksum.empty_crc64nvme()
    elif algorithm == "SHA256_CHUNKED":
        return Checksum.empty_sha256_chunked()
    else:
        raise PkgpushException("UnsupportedChecksumAlgorithm", {"algorithm": algorithm})


def try_get_crc64nvme_via_head(s3_client, pk: PhysicalKey) -> T.Optional[Checksum]:
    """
    Try to get precomputed CRC64NVME checksum using HeadObject with ChecksumMode=ENABLED.

    Note: Uses HeadObject instead of GetObjectAttributes because:
    - Cheaper API call
    - No separate s3:GetObjectAttributes permission needed (uses existing s3:GetObject)
    - CRC64NVME has no chunked variant, so no compliance check needed
    """
    try:
        resp = s3_client.head_object(
            **S3ObjectSource.from_pk(pk).boto_args,
            ChecksumMode="ENABLED",
        )
        checksum_value = resp.get("ChecksumCRC64NVME")
        if checksum_value is not None:
            checksum_bytes = base64.b64decode(checksum_value)
            return Checksum.crc64nvme(checksum_bytes)
        return None
    except botocore.exceptions.ClientError:
        return None


def try_get_compliant_sha256_chunked(s3_client, pk: PhysicalKey, file_size: int) -> T.Optional[Checksum]:
    """
    Try to get compliant SHA256_CHUNKED checksum using GetObjectAttributes.

    "Compliant" means the object's part sizes match our expected part size boundaries.
    This requires GetObjectAttributes to retrieve ObjectParts information.

    Note: This is more expensive than HeadObject and requires s3:GetObjectAttributes permission,
    but it's necessary to validate part size compliance for SHA256_CHUNKED.
    """
    try:
        from quilt_shared.const import MAX_PARTS, MIN_PART_SIZE

        resp = s3_client.get_object_attributes(
            **S3ObjectSource.from_pk(pk).boto_args,
            ObjectAttributes=["Checksum", "ObjectParts", "ObjectSize"],
            MaxParts=MAX_PARTS,
        )

        checksum_value = resp.get("Checksum", {}).get("ChecksumSHA256")
        if checksum_value is None:
            return None

        # Calculate expected part size (same logic as s3hash lambda)
        def get_part_size(size: int) -> T.Optional[int]:
            if size < MIN_PART_SIZE:
                return None
            num_parts, rem = divmod(size, MIN_PART_SIZE)
            if rem:
                num_parts += 1
            while num_parts > MAX_PARTS:
                num_parts, rem = divmod(num_parts, 2)
                if rem:
                    num_parts += 1
            part_size, rem = divmod(size, num_parts)
            if rem:
                part_size += 1
            return part_size

        part_size = get_part_size(file_size)
        if part_size is None:
            return None

        object_parts = resp.get("ObjectParts")
        if object_parts is None:
            return None

        num_parts = object_parts["TotalPartsCount"]
        parts = object_parts.get("Parts", [])

        # Make sure we have all parts
        if len(parts) != num_parts:
            return None

        # Check if part sizes match expected
        expected_num_parts, remainder = divmod(file_size, part_size)
        expected_part_sizes = [part_size] * expected_num_parts + ([remainder] if remainder else [])
        actual_part_sizes = [part.get("Size") for part in parts]

        if actual_part_sizes == expected_part_sizes:
            checksum_bytes = base64.b64decode(checksum_value)
            return Checksum.sha256_chunked(checksum_bytes)

        return None
    except botocore.exceptions.ClientError:
        return None


def compute_checksum_via_copy(s3_client, pk: PhysicalKey, scratch_buckets: T.Dict[str, str], algorithm: str) -> Checksum:
    """
    Compute checksum for small file using copy_object with ChecksumAlgorithm.
    Only SHA256_CHUNKED and CRC64NVME are supported.
    """
    region = get_bucket_region(pk.bucket)

    if algorithm == "CRC64NVME":
        resp = s3_client.copy_object(
            CopySource=S3ObjectSource.from_pk(pk).boto_args,
            Bucket=scratch_buckets[region],
            Key=make_scratch_key(),
            ChecksumAlgorithm="CRC64NVME",
        )
        checksum_bytes = base64.b64decode(resp["CopyObjectResult"]["ChecksumCRC64NVME"])
        return Checksum.crc64nvme(checksum_bytes)
    elif algorithm == "SHA256_CHUNKED":
        resp = s3_client.copy_object(
            CopySource=S3ObjectSource.from_pk(pk).boto_args,
            Bucket=scratch_buckets[region],
            Key=make_scratch_key(),
            ChecksumAlgorithm="SHA256",
        )
        checksum_bytes = base64.b64decode(resp["CopyObjectResult"]["ChecksumSHA256"])
        return Checksum.sha256_chunked(checksum_bytes)
    else:
        raise PkgpushException("UnsupportedChecksumAlgorithm", {"algorithm": algorithm})


def invoke_hash_lambda(
    pk: PhysicalKey,
    credentials: AWSCredentials,
    scratch_buckets: T.Dict[str, str],
    checksum_algorithm: str,
) -> Checksum:
    logger.info(f"[PERF] invoke_hash_lambda START: {pk} algorithm={checksum_algorithm}")
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
    logger.info(f"[PERF] invoke_hash_lambda END: {pk} -> {checksum.type}")
    return checksum


def calculate_pkg_entry_hash(
    pkg_entry: quilt3.packages.PackageEntry,
    credentials: AWSCredentials,
    scratch_buckets: T.Dict[str, str],
    checksum_algorithm: str,
):
    pkg_entry.hash = invoke_hash_lambda(pkg_entry.physical_key, credentials, scratch_buckets, checksum_algorithm).dict()


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


def calculate_pkg_hashes(pkg: quilt3.Package, scratch_buckets: T.Dict[str, str], checksum_algorithms: T.Optional[T.List[str]] = None):
    """
    Calculate checksums for package entries using priority-based selection.

    Args:
        pkg: Package to calculate hashes for
        scratch_buckets: Scratch buckets for checksum computation
        checksum_algorithms: Priority-ordered list of algorithms (default: CHECKSUM_ALGORITHMS from env)

    Algorithm selection:
    1. For empty files: Use highest-priority algorithm's empty checksum
    2. For non-empty files: Try to get precomputed checksums in priority order:
       - CRC64NVME: HeadObject with ChecksumMode=ENABLED (cheap, no extra permissions)
       - SHA256_CHUNKED: GetObjectAttributes to check compliance (expensive, needs extra permissions)
    3. If no precomputed: Compute using highest-priority algorithm
    """
    if checksum_algorithms is None:
        checksum_algorithms = CHECKSUM_ALGORITHMS

    if not checksum_algorithms:
        raise PkgpushException("NoChecksumAlgorithms", {"details": "At least one checksum algorithm required"})

    highest_priority_algorithm = checksum_algorithms[0]
    logger.info(f"[PERF] calculate_pkg_hashes START: algorithms={checksum_algorithms}, highest_priority={highest_priority_algorithm}")

    entries_to_hash = []
    for lk, entry in pkg.walk():
        if entry.hash is not None:
            continue
        assert isinstance(entry.size, int)
        if entry.size > S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES:
            raise PkgpushException(
                "FileTooLargeForHashing",
                {
                    "logical_key": lk,
                    "size": entry.size,
                    "max_size": S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES,
                },
            )

        if not entry.size:
            # Empty file: use highest-priority algorithm's empty checksum
            entry.hash = get_empty_checksum(highest_priority_algorithm).dict()
        else:
            entries_to_hash.append(entry)

    logger.info(f"[PERF] Hash strategy: {len(entries_to_hash)} files need checksums")

    # Sort all entries by size descending to minimize tail latency
    entries_to_hash.sort(key=lambda entry: entry.size, reverse=True)

    assert user_boto_session is not None
    credentials = AWSCredentials.from_boto_session(user_boto_session)
    user_s3_client = user_boto_session.client(
        "s3",
        config=botocore.client.Config(max_pool_connections=LOCAL_HASH_CONCURRENCY),
    )

    logger.info("[PERF] Phase 1: Trying precomputed checksums concurrently")

    def try_get_precomputed(entry: quilt3.packages.PackageEntry):
        """Try to get precomputed checksum in priority order (doesn't compute)"""
        pk = entry.physical_key
        logger.info(f"[PERF] Trying precomputed: {pk}")

        # Try to get precomputed checksums in priority order
        for algorithm in checksum_algorithms:
            if algorithm == "CRC64NVME":
                checksum = try_get_crc64nvme_via_head(user_s3_client, pk)
                if checksum is not None:
                    entry.hash = checksum.dict()
                    logger.info(f"[PERF] Found precomputed CRC64NVME: {pk}")
                    return None
            elif algorithm == "SHA256_CHUNKED":
                checksum = try_get_compliant_sha256_chunked(user_s3_client, pk, entry.size)
                if checksum is not None:
                    entry.hash = checksum.dict()
                    logger.info(f"[PERF] Found compliant SHA256_CHUNKED: {pk}")
                    return None

        # No precomputed checksum found
        logger.info(f"[PERF] No precomputed checksum: {pk}")
        return entry

    def compute_via_copy(entry: quilt3.packages.PackageEntry):
        """Compute checksum for small file via copy_object"""
        logger.info(f"[PERF] Computing via copy_object: {entry.physical_key}")
        entry.hash = compute_checksum_via_copy(
            user_s3_client,
            entry.physical_key,
            scratch_buckets,
            highest_priority_algorithm,
        ).dict()
        logger.info(f"[PERF] Computed via copy_object: {entry.physical_key}")

    def compute_via_s3hash(entry: quilt3.packages.PackageEntry):
        """Compute checksum for large file via s3hash lambda"""
        logger.info(f"[PERF] Computing via s3hash lambda: {entry.physical_key}")
        entry.hash = invoke_hash_lambda(
            entry.physical_key,
            credentials,
            scratch_buckets,
            highest_priority_algorithm,
        ).dict()
        logger.info(f"[PERF] Computed via s3hash lambda: {entry.physical_key}")

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

            assert isinstance(entry.size, int)
            if entry.size < MIN_PART_SIZE:
                cf = local_pool.submit(compute_via_copy, entry)
            else:
                cf = s3hash_pool.submit(compute_via_s3hash, entry)
            comp_futures.append(cf)

        # Wait for all computations to complete
        concurrent.futures.wait(comp_futures)

    logger.info("[PERF] calculate_pkg_hashes END")


def invoke_copy_lambda(credentials: AWSCredentials, src: PhysicalKey, dst: PhysicalKey) -> T.Optional[str]:
    result = invoke_lambda(
        function_name=S3_COPY_LAMBDA,
        params=S3CopyLambdaParams(
            credentials=credentials,
            location=S3ObjectSource.from_pk(src),
            target=S3ObjectDestination.from_pk(dst),
        ),
        err_prefix="S3CopyLambda",
    )
    return CopyResult(**result).version


def copy_pkg_entry_data(
    credentials: AWSCredentials,
    src: PhysicalKey,
    dst: PhysicalKey,
    idx: int,
) -> T.Tuple[int, T.Tuple[PhysicalKey, T.Optional[str]]]:
    version_id = invoke_copy_lambda(credentials, src, dst)
    versioned_key = PhysicalKey(bucket=dst.bucket, path=dst.path, version_id=version_id)
    # Return tuple of (versioned_key, checksum) - checksum is None since we don't compute it during copy
    return idx, (versioned_key, None)


def copy_file_list(
    file_list: T.List[T.Tuple[PhysicalKey, PhysicalKey, int]],
    message=None,
    callback=None,
) -> T.List[T.Tuple[PhysicalKey, T.Optional[str]]]:
    logger.info(f"[PERF] copy_file_list START: {len(file_list)} files")
    # TODO: Copy single part files directly, because using lambda for that just adds overhead,
    #       this can be done is a separate thread pool providing higher concurrency.
    # TODO: Use checksums to deduplicate?
    # Schedule longer tasks first so we don't end up waiting for a single long task.
    file_list_enumerated = list(enumerate(file_list))
    file_list_enumerated.sort(key=lambda x: x[1][2], reverse=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=S3_COPY_LAMBDA_CONCURRENCY) as pool:
        credentials = AWSCredentials.from_boto_session(user_boto_session)
        fs = [
            pool.submit(copy_pkg_entry_data, credentials, src, dst, idx)
            for idx, (src, dst, _) in file_list_enumerated
        ]
        results = [
            f.result()
            for f in concurrent.futures.as_completed(fs)
        ]
        # Sort by idx to restore original order.
        results.sort(key=lambda x: x[0])

    logger.info(f"[PERF] copy_file_list END: {len(file_list)} files")
    return [x[1] for x in results]


# Isolated for test-ability.
get_user_boto_session = boto3.Session


class Event(pydantic.v1.BaseModel):
    credentials: AWSCredentials
    params: T.Any


@contextlib.contextmanager
def setup_user_boto_session(session):
    global user_boto_session
    user_boto_session = session
    try:
        yield user_boto_session
    finally:
        user_boto_session = None


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
) -> T.Dict[str, T.Any]:
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
            copy_file_list_fn=copy_file_list,
        )
        assert result._origin is not None
        return PackagePushResult(top_hash=result._origin.top_hash)
    except quilt3.util.QuiltException as qe:
        raise PkgpushException.from_quilt_exception(qe)
    except botocore.exceptions.ClientError as boto_error:
        raise PkgpushException.from_boto_error(boto_error)
    except quilt3.data_transfer.S3NoValidClientError as e:
        raise PkgpushException("Forbidden", {"details": e.message})


@exception_handler
@auth
@setup_telemetry
@pydantic.v1.validate_arguments
def promote_package(params: PackagePromoteParams) -> PackagePushResult:
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

    return _push_pkg_to_successor(
        params,
        src_bucket=params.src.bucket,
        get_pkg=get_pkg,
        pkg_max_size=PROMOTE_PKG_MAX_PKG_SIZE,
        pkg_max_files=PROMOTE_PKG_MAX_FILES,
    )


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
    logger.info(f"[PERF] create_package START: {params.bucket}/{params.name}")
    logger.info(f"[PERF] Using checksum algorithms: {CHECKSUM_ALGORITHMS}")
    registry_url = f"s3://{params.bucket}"
    try:
        package_registry = get_registry(registry_url)

        quilt3.util.validate_package_name(params.name)
        pkg = quilt3.Package()
        if params.user_meta is not None:
            pkg.set_meta(params.user_meta)

        # Phase 1: Parse entries and create PackageEntry objects (store temporarily)
        logger.info("[PERF] Parsing entries and creating PackageEntry objects")
        pkg_entries: T.Dict[str, quilt3.packages.PackageEntry] = {}
        entries_need_metadata = []

        for entry in map(PackageConstructEntry.parse_raw, req_file):
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
            pkg_entry = quilt3.packages.PackageEntry(
                physical_key,
                entry.size,  # May be None - will fetch via HEAD
                entry.hash.dict() if entry.hash else None,
                entry.meta,
            )
            pkg_entries[entry.logical_key] = pkg_entry

            # Track entries that need metadata/checksum fetching
            needs_metadata = physical_key.version_id is None or entry.size is None or entry.hash is None
            if needs_metadata:
                entries_need_metadata.append(entry.logical_key)

        logger.info(f"[PERF] Created {len(pkg_entries)} PackageEntry objects, {len(entries_need_metadata)} need metadata")

        # Phase 2: Fetch missing metadata and precomputed checksums concurrently
        if entries_need_metadata:
            assert user_boto_session is not None
            user_s3_client = user_boto_session.client(
                "s3",
                config=botocore.client.Config(max_pool_connections=LOCAL_HASH_CONCURRENCY),
            )

            def fetch_and_update_metadata(logical_key: str):
                """Fetch metadata and precomputed checksums, mutate PackageEntry in place"""
                pkg_entry = pkg_entries[logical_key]
                pk = pkg_entry.physical_key
                logger.info(f"[PERF] HEAD request (with checksums): s3://{pk.bucket}/{pk.path}")

                try:
                    resp = user_s3_client.head_object(
                        Bucket=pk.bucket,
                        Key=pk.path,
                        ChecksumMode="ENABLED",  # Get precomputed checksums
                    )

                    # Update physical_key with version_id if missing
                    if pk.version_id is None:
                        pkg_entry._physical_key = PhysicalKey(
                            pk.bucket,
                            pk.path,
                            resp.get("VersionId"),
                        )

                    # Update size if missing
                    if pkg_entry.size is None:
                        pkg_entry._size = resp["ContentLength"]

                    # Try to get precomputed checksum (priority order)
                    if pkg_entry.hash is None:
                        for algorithm in CHECKSUM_ALGORITHMS:
                            if algorithm == "CRC64NVME":
                                checksum_value = resp.get("ChecksumCRC64NVME")
                                if checksum_value is not None:
                                    checksum_bytes = base64.b64decode(checksum_value)
                                    pkg_entry.hash = Checksum.crc64nvme(checksum_bytes).dict()
                                    logger.info(f"[PERF] Found precomputed CRC64NVME via HEAD: {logical_key}")
                                    break
                            # SHA256_CHUNKED cannot be reliably retrieved via HEAD (needs GetObjectAttributes with part validation)
                            # Will be handled by calculate_pkg_hashes if still needed

                    logger.info(
                        f"[PERF] HEAD success: {logical_key} "
                        f"version={pkg_entry.physical_key.version_id} size={pkg_entry.size} "
                        f"hash={pkg_entry.hash['type'] if pkg_entry.hash else None}"
                    )
                except botocore.exceptions.ClientError as e:
                    raise PkgpushException(
                        "FailedToFetchObjectMetadata",
                        {
                            "logical_key": logical_key,
                            "physical_key": str(pk),
                            "error": str(e),
                        },
                    )

            logger.info(f"[PERF] Fetching metadata for {len(entries_need_metadata)} objects concurrently")
            with concurrent.futures.ThreadPoolExecutor(max_workers=LOCAL_HASH_CONCURRENCY) as pool:
                futures = [pool.submit(fetch_and_update_metadata, lk) for lk in entries_need_metadata]
                # Check for exceptions
                for f in concurrent.futures.as_completed(futures):
                    f.result()  # Raises exception if any occurred

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

    calculate_pkg_hashes(pkg, params.scratch_buckets)
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


@functools.cache
def setup_user_boto_session_from_default():
    global user_boto_session
    user_boto_session = get_user_boto_session()


def get_scratch_buckets() -> T.Dict[str, str]:
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

    for record in event["Records"]:
        package_prefix(record["body"], context)


def list_prefix_latest_versions(bucket: str, prefix: str):
    paginator = s3.get_paginator("list_object_versions")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Versions", []):
            if not obj["IsLatest"]:
                continue
            key = obj["Key"]
            if key.endswith("/"):
                if obj["Size"] != 0:
                    warnings.warn(f'Logical keys cannot end in "/", skipping: {key}')
                continue
            yield obj


def package_prefix(event, context):
    params = PackagerEvent.parse_raw(event)

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

    setup_user_boto_session_from_default()

    pkg = quilt3.Package()

    prefix_len = len(prefix_pk.path)

    for obj in list_prefix_latest_versions(prefix_pk.bucket, prefix_pk.path):
        key = obj["Key"]
        size = obj["Size"]
        entry = quilt3.packages.PackageEntry(
            PhysicalKey(prefix_pk.bucket, key, obj.get("VersionId")),
            size,
            None,
            None,
        )
        pkg.set(key[prefix_len:], entry)
        # XXX: We know checksum algorithm here, so if it's sha256,
        #      we can be sure there's compliant checksum in S3 for single-part objects.
        #      We could replace copy_object with head_object in calculate_pkg_entry_hash_local.
        #      * head_object call takes 70 msec
        #      * copy_object time depends on file size:
        #        * 8 MB - 350 msec
        #        * 1 B - 35 msec
        #        * it looks like copy_object is slower than head_object for objects >= 16 KiB

    pkg.set_meta(metadata)
    pkg._validate_with_workflow(
        registry=package_registry,
        workflow=params.workflow_normalized,
        name=pkg_name,
        message=params.commit_message,
    )
    calculate_pkg_hashes(pkg, get_scratch_buckets())
    pkg._build(
        name=pkg_name,
        registry=registry_url,
        message=params.commit_message,
    )
