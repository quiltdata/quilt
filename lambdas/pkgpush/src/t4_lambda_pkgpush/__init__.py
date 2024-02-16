from __future__ import annotations

import concurrent.futures
import contextlib
import functools
import json
import logging
import os
import tempfile
import typing as T

import boto3
import botocore.client
import botocore.credentials
import botocore.exceptions
import pydantic

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
from quilt_shared.const import LAMBDA_READ_TIMEOUT
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
    PackagePromoteParams,
    PackagePushParams,
    PackagePushResult,
    S3CopyLambdaParams,
    S3HashLambdaParams,
    S3ObjectDestination,
    S3ObjectSource,
    TopHash,
)

# XXX: use pydantic to manage settings
PROMOTE_PKG_MAX_MANIFEST_SIZE = int(os.environ["PROMOTE_PKG_MAX_MANIFEST_SIZE"])
PROMOTE_PKG_MAX_PKG_SIZE = int(os.environ["PROMOTE_PKG_MAX_PKG_SIZE"])
PROMOTE_PKG_MAX_FILES = int(os.environ["PROMOTE_PKG_MAX_FILES"])
MAX_BYTES_TO_HASH = int(os.environ["MAX_BYTES_TO_HASH"])
MAX_FILES_TO_HASH = int(os.environ["MAX_FILES_TO_HASH"])
# To dispatch separate, stack-created lambda functions.
S3_COPY_LAMBDA = os.environ["S3_COPY_LAMBDA"]
S3_HASH_LAMBDA = os.environ["S3_HASH_LAMBDA"]
# CFN template guarantees S3_HASH_LAMBDA_CONCURRENCY concurrent invocation of S3 hash lambda without throttling.
S3_COPY_LAMBDA_CONCURRENCY = S3_HASH_LAMBDA_CONCURRENCY = int(os.environ["S3_HASH_LAMBDA_CONCURRENCY"])
S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES = int(os.environ["S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES"])

SERVICE_BUCKET = os.environ["SERVICE_BUCKET"]

logger = logging.getLogger("quilt-lambda-pkgpush")
logger.setLevel(os.environ.get("QUILT_LOG_LEVEL", "WARNING"))

s3 = boto3.client("s3")
lambda_ = boto3.client(
    "lambda",
    config=botocore.client.Config(
        read_timeout=LAMBDA_READ_TIMEOUT,
        # Prevent idle timeout on NAT gateway.
        tcp_keepalive=True,
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


def invoke_hash_lambda(pk: PhysicalKey, credentials: AWSCredentials) -> Checksum:
    resp = lambda_.invoke(
        FunctionName=S3_HASH_LAMBDA,
        Payload=S3HashLambdaParams(
            credentials=credentials,
            location=S3ObjectSource.from_pk(pk),
        ).json(exclude_defaults=True),
    )

    parsed = json.load(resp["Payload"])

    if "FunctionError" in resp:
        raise PkgpushException("S3HashLambdaUnhandledError", parsed)

    if "error" in parsed:
        raise PkgpushException("S3HashLambdaError", parsed["error"])

    return ChecksumResult(**parsed["result"]).checksum


def calculate_pkg_entry_hash(
    pkg_entry: quilt3.packages.PackageEntry,
    credentials: AWSCredentials,
):
    pkg_entry.hash = invoke_hash_lambda(pkg_entry.physical_key, credentials).dict()


def calculate_pkg_hashes(pkg: quilt3.Package):
    entries = []
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

        entries.append(entry)

    # Schedule longer tasks first so we don't end up waiting for a single long task.
    entries.sort(key=lambda entry: entry.size, reverse=True)
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=S3_HASH_LAMBDA_CONCURRENCY
    ) as pool:
        credentials = AWSCredentials.from_boto_session(user_boto_session)
        fs = [
            pool.submit(calculate_pkg_entry_hash, entry, credentials)
            for entry in entries
        ]
        for f in concurrent.futures.as_completed(fs):
            f.result()


# TODO: implement
def invoke_copy_lambda(credentials: AWSCredentials, src: PhysicalKey, dst: PhysicalKey) -> str:
    resp = lambda_.invoke(
        FunctionName=S3_COPY_LAMBDA,
        Payload=S3CopyLambdaParams(
            credentials=credentials,
            location=S3ObjectSource.from_pk(src),
            target=S3ObjectDestination.from_pk(dst),
        ).json(exclude_defaults=True),
    )

    parsed = json.load(resp["Payload"])

    if "FunctionError" in resp:
        raise PkgpushException("S3CopyLambdaUnhandledError", parsed)

    if "error" in parsed:
        raise PkgpushException("S3CopyLambdaError", parsed["error"])

    return CopyResult(**parsed["result"]).version


def copy_pkg_entry_data(
    credentials: AWSCredentials,
    src: PhysicalKey,
    dst: PhysicalKey,
    idx: int,
) -> T.Tuple[int, PhysicalKey]:
    version_id = invoke_copy_lambda(credentials, src, dst)
    return idx, PhysicalKey(bucket=dst.bucket, path=dst.path, version_id=version_id)


def copy_file_list(
    file_list: T.List[T.Tuple[PhysicalKey, PhysicalKey, int]],
    message=None,
    callback=None,
) -> T.List[PhysicalKey]:
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

    return [x[1] for x in results]


# Isolated for test-ability.
get_user_boto_session = boto3.Session


class Event(pydantic.BaseModel):
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
    @pydantic.validate_arguments
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
        except pydantic.ValidationError as e:
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
    params: PackagePushParams,
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
@pydantic.validate_arguments
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
    params = PackagePushParams.parse_raw(next(req_file))
    registry_url = f"s3://{params.bucket}"
    try:
        package_registry = get_registry(registry_url)

        quilt3.util.validate_package_name(params.name)
        pkg = quilt3.Package()
        if params.user_meta is not None:
            pkg.set_meta(params.user_meta)

        size_to_hash = 0
        files_to_hash = 0
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

            if entry.hash and entry.size is not None:
                pkg.set(
                    entry.logical_key,
                    quilt3.packages.PackageEntry(
                        physical_key,
                        entry.size,
                        entry.hash.dict(),
                        entry.meta,
                    ),
                )
            else:
                pkg.set(entry.logical_key, str(physical_key))
                pkg_entry = pkg[entry.logical_key]
                assert isinstance(pkg_entry, quilt3.packages.PackageEntry)
                pkg_entry._meta = entry.meta or {}

                assert isinstance(pkg_entry.size, int)
                size_to_hash += pkg_entry.size
                if size_to_hash > MAX_BYTES_TO_HASH:
                    raise PkgpushException(
                        "PackageTooLargeToHash",
                        {
                            "size": size_to_hash,
                            "max_size": MAX_BYTES_TO_HASH,
                        },
                    )

                files_to_hash += 1
                if files_to_hash > MAX_FILES_TO_HASH:
                    raise PkgpushException(
                        "TooManyFilesToHash",
                        {
                            "num_files": files_to_hash,
                            "max_files": MAX_FILES_TO_HASH,
                        },
                    )

        pkg._validate_with_workflow(
            registry=package_registry,
            workflow=params.workflow_normalized,
            name=params.name,
            message=params.message,
        )

    except quilt3.util.QuiltException as qe:
        raise PkgpushException.from_quilt_exception(qe)

    calculate_pkg_hashes(pkg)
    try:
        top_hash = pkg._build(
            name=params.name,
            registry=registry_url,
            message=params.message,
        )
    except botocore.exceptions.ClientError as boto_error:
        raise PkgpushException.from_boto_error(boto_error)

    # XXX: return mtime?
    return PackagePushResult(top_hash=TopHash(top_hash))
