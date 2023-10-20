"""
Overall performance of this function is mostly limited by hashing rate which is
limited by lambda's network throughput. Max network thoughput in
benchmarks was about 75 MiB/s. To overcome this limitation this function
concurrently invokes dedicated hash lambda for multiple files.
"""
# TODO: adjust the decsription above
from __future__ import annotations

import concurrent.futures
import contextlib
import contextvars
import enum
import functools
import json
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
from t4_lambda_shared.utils import LAMBDA_TMP_SPACE, get_quilt_logger

# XXX: use pydantic to manage settings
PROMOTE_PKG_MAX_MANIFEST_SIZE = int(os.environ["PROMOTE_PKG_MAX_MANIFEST_SIZE"])
PROMOTE_PKG_MAX_PKG_SIZE = int(os.environ["PROMOTE_PKG_MAX_PKG_SIZE"])
PROMOTE_PKG_MAX_FILES = int(os.environ["PROMOTE_PKG_MAX_FILES"])
PKG_FROM_FOLDER_MAX_PKG_SIZE = int(os.environ["PKG_FROM_FOLDER_MAX_PKG_SIZE"])
PKG_FROM_FOLDER_MAX_FILES = int(os.environ["PKG_FROM_FOLDER_MAX_FILES"])
# To dispatch separate, stack-created lambda function.
S3_HASH_LAMBDA = os.environ["S3_HASH_LAMBDA"]
# CFN template guarantees S3_HASH_LAMBDA_CONCURRENCY concurrent invocation of S3 hash lambda without throttling.
S3_HASH_LAMBDA_CONCURRENCY = int(os.environ["S3_HASH_LAMBDA_CONCURRENCY"])
S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES = int(
    os.environ["S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES"]
)

S3_HASH_LAMBDA_READ_TIMEOUT = 15 * 60  # Max lambda duration.

SERVICE_BUCKET = os.environ["SERVICE_BUCKET"]
USER_REQUESTS_PREFIX = "user-requests/"

logger = get_quilt_logger()

s3 = boto3.client("s3")
lambda_ = boto3.client(
    "lambda",
    config=botocore.client.Config(read_timeout=S3_HASH_LAMBDA_READ_TIMEOUT),
)


user_boto_session = contextvars.ContextVar[boto3.Session]("user_boto_session")


def quilt_get_boto_session(self):
    return user_boto_session.get()


# Monkey patch quilt3 S3ClientProvider, so it builds a client using user credentials.
quilt3.data_transfer.S3ClientProvider.get_boto_session = quilt_get_boto_session


class PkgpushException(Exception):
    def __init__(self, name, context=None):
        super().__init__(name, context)
        self.name = name
        self.context = context

    def dict(self):
        return {"name": self.name, "context": self.context}

    @classmethod
    def from_boto_error(cls, boto_error: botocore.exceptions.ClientError):
        boto_response = boto_error.response
        status_code = boto_response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        error_code = boto_response.get("Error", {}).get("Code")
        error_message = boto_response.get("Error", {}).get("Message")
        return cls(
            "AWSError",
            {
                "status_code": status_code,
                "error_code": error_code,
                "error_message": error_message,
            },
        )

    @classmethod
    def from_quilt_exception(cls, qe: quilt3.util.QuiltException):
        name = (
            "WorkflowValidationError"
            if isinstance(qe, quilt3.workflows.WorkflowValidationError)
            else "QuiltException"
        )
        return cls(name, {"details": qe.message})


NonEmptyStr = pydantic.constr(min_length=1, strip_whitespace=True)

TopHash = pydantic.constr(
    min_length=64,
    max_length=64,
    regex=r"^[0-9a-f]+$",
    strip_whitespace=True,
    to_lower=True,
)


class AWSCredentials(pydantic.BaseModel):
    key: NonEmptyStr
    secret: NonEmptyStr
    token: NonEmptyStr

    @property
    def boto_args(self):
        return dict(
            aws_access_key_id=self.key,
            aws_secret_access_key=self.secret,
            aws_session_token=self.token,
        )

    @classmethod
    def from_boto_session(cls, session: boto3.Session):
        credentials = session.get_credentials()
        return cls(
            key=credentials.access_key,
            secret=credentials.secret_key,
            token=credentials.token,
        )


class S3ObjectSource(pydantic.BaseModel):
    bucket: str
    key: str
    version: str

    @classmethod
    def from_pk(cls, pk: PhysicalKey):
        return S3ObjectSource(bucket=pk.bucket, key=pk.path, version=pk.version_id)


class S3ObjectDestination(pydantic.BaseModel):
    bucket: str
    key: str


class S3HashLambdaParams(pydantic.BaseModel):
    credentials: AWSCredentials
    location: S3ObjectSource
    target: T.Optional[S3ObjectDestination] = None
    concurrency: T.Optional[pydantic.PositiveInt] = None


class ChecksumType(str, enum.Enum):
    MP = "QuiltMultipartSHA256"
    SP = "SHA256"


class Checksum(pydantic.BaseModel):
    type: ChecksumType
    value: str


class MPURef(pydantic.BaseModel):
    bucket: str
    key: str
    id: str


class ChecksumResult(pydantic.BaseModel):
    checksum: Checksum
    stats: T.Optional[dict] = None


def invoke_hash_lambda(pk: PhysicalKey, credentials: AWSCredentials) -> Checksum:
    logger.info("invoke hash lambda")
    resp = lambda_.invoke(
        FunctionName=S3_HASH_LAMBDA,
        Payload=S3HashLambdaParams(
            credentials=credentials,
            location=S3ObjectSource.from_pk(pk),
        ).json(exclude_defaults=True),
    )

    parsed = json.load(resp["Payload"])
    logger.info("response from hash lambda: %s", parsed)

    if "FunctionError" in resp:
        raise PkgpushException("S3HashLambdaUnhandledError", parsed)

    if "error" in parsed:
        raise PkgpushException("S3HashLambdaError", parsed["error"])

    return ChecksumResult(**parsed["result"]).checksum


def calculate_pkg_entry_hash(
    pkg_entry: quilt3.packages.PackageEntry,
    credentials: AWSCredentials,
):
    logger.info("calculate_pkg_entry_hash(%s): start", pkg_entry.physical_key)
    pkg_entry.hash = invoke_hash_lambda(pkg_entry.physical_key, credentials).dict()
    logger.info("calculate_pkg_entry_hash(%s): done", pkg_entry.physical_key)


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

    logger.info("calculate_pkg_hashes: %s entries to hash", len(entries))

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=S3_HASH_LAMBDA_CONCURRENCY
    ) as pool:
        credentials = AWSCredentials.from_boto_session(user_boto_session.get())
        fs = [
            pool.submit(calculate_pkg_entry_hash, entry, credentials)
            for entry in entries
        ]
        for f in concurrent.futures.as_completed(fs):
            f.result()

    logger.info("calculate_pkg_hashes: done")


# Isolated for test-ability.
get_user_boto_session = boto3.Session


class Event(pydantic.BaseModel):
    credentials: AWSCredentials
    params: T.Any


def auth(f):
    @functools.wraps(f)
    @pydantic.validate_arguments
    def wrapper(event: Event):
        session = get_user_boto_session(**event.credentials.boto_args)
        token = user_boto_session.set(session)
        try:
            return f(event.params)
        finally:
            user_boto_session.reset(token)

    return wrapper


def exception_handler(f):
    @functools.wraps(f)
    def wrapper(event, context):
        # XXX: make sure to disable in production to avoid leaking credentials
        logger.info("event: %s", event)
        logger.info("context: %s", context)
        try:
            result = f(event)
            logger.info("result: %s", result)
            return {"result": result.dict()}
        except PkgpushException as e:
            logger.exception("PkgpushException")
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


def _push_pkg_to_successor(
    params: PackagePushParams,
    *,
    src_bucket: str,
    get_pkg: T.Callable[[S3PackageRegistryV1], quilt3.Package],
    pkg_max_size: int,
    pkg_max_files: int,
) -> PackagePushResult:
    logger.info("_push_pkg_to_successor: %s -> %s", src_bucket, params)

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
        )
        assert result._origin is not None
        return PackagePushResult(top_hash=result._origin.top_hash)
    except quilt3.util.QuiltException as qe:
        raise PkgpushException.from_quilt_exception(qe)
    except botocore.exceptions.ClientError as boto_error:
        raise PkgpushException.from_boto_error(boto_error)
    except quilt3.data_transfer.S3NoValidClientError as e:
        raise PkgpushException("Forbidden", {"details": e.message})


class PackagePromoteSource(pydantic.BaseModel):
    bucket: NonEmptyStr
    name: NonEmptyStr
    top_hash: TopHash


class PackagePromoteParams(PackagePushParams):
    src: PackagePromoteSource


@exception_handler
@auth
@setup_telemetry
@pydantic.validate_arguments
def promote_package(params: PackagePromoteParams) -> PackagePushResult:
    logger.info("promote_package(%s)", params)

    def get_pkg(src_registry: S3PackageRegistryV1):
        quilt3.util.validate_package_name(params.src.name)

        manifest_pk = src_registry.manifest_pk(params.src.name, params.src.top_hash)
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


class PackageFromFolderEntry(pydantic.BaseModel):
    logical_key: NonEmptyStr
    path: NonEmptyStr
    is_dir: bool


class PackageFromFolderParams(PackagePushParams):
    src_bucket: NonEmptyStr
    entries: T.List[PackageFromFolderEntry]


@exception_handler
@auth
@setup_telemetry
@pydantic.validate_arguments
def package_from_folder(params: PackageFromFolderParams) -> PackagePushResult:
    logger.info("package_from_folder(%s)", params)

    def get_pkg(src_registry: S3PackageRegistryV1):
        p = quilt3.Package()
        for entry in params.entries:
            set_entry = p.set_dir if entry.is_dir else p.set
            set_entry(entry.logical_key, str(src_registry.base.join(entry.path)))
        calculate_pkg_hashes(p)
        return p

    return _push_pkg_to_successor(
        params,
        src_bucket=params.src_bucket,
        get_pkg=get_pkg,
        pkg_max_size=PKG_FROM_FOLDER_MAX_PKG_SIZE,
        pkg_max_files=PKG_FROM_FOLDER_MAX_FILES,
    )


@contextlib.contextmanager
def request_from_file(request_type: str, version_id: str):
    user_request_key = USER_REQUESTS_PREFIX + request_type

    try:
        size = s3.head_object(
            Bucket=SERVICE_BUCKET,
            Key=user_request_key,
            VersionId=version_id,
        )["ContentLength"]
        if size > LAMBDA_TMP_SPACE:
            raise PkgpushException(
                "RequestTooLarge",
                {"size": size, "max_size": LAMBDA_TMP_SPACE},
            )

        # download file with user request using lambda's role
        with tempfile.TemporaryFile() as tmp_file:
            s3.download_fileobj(
                SERVICE_BUCKET,
                user_request_key,
                tmp_file,
                ExtraArgs={"VersionId": version_id},
            )
            tmp_file.seek(0)
            yield tmp_file

    finally:
        try:
            s3.delete_object(
                Bucket=SERVICE_BUCKET,
                Key=user_request_key,
                VersionId=version_id,
            )
        except Exception:
            logger.exception("Error while removing user request file from S3")


VersionId = pydantic.constr(strip_whitespace=True, min_length=1, max_length=1024)


# XXX: move to shared
def large_request_handler(request_type: str):
    def inner(f: T.Callable[[T.IO[bytes]], T.Any]):
        @functools.wraps(f)
        @pydantic.validate_arguments
        def wrapper(version_id: VersionId):
            with request_from_file(request_type, version_id) as req_file:
                return f(req_file)

        return wrapper

    return inner


class PackageConstructEntry(pydantic.BaseModel):
    logical_key: NonEmptyStr
    physical_key: NonEmptyStr
    size: T.Optional[int] = None
    hash: T.Optional[Checksum] = None
    # `meta` is the full metadata dict for entry that includes
    # optional `user_meta` property,
    # see PackageEntry._meta vs PackageEntry.meta.
    meta: T.Optional[T.Dict[str, T.Any]] = None


@exception_handler
@auth
@setup_telemetry
@large_request_handler("create-package")
def create_package(req_file: T.IO[bytes]) -> PackagePushResult:
    params = PackagePushParams.parse_raw(next(req_file))
    logger.info("create_package(%s)", params)

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
                if size_to_hash > PKG_FROM_FOLDER_MAX_PKG_SIZE:
                    raise PkgpushException(
                        "PackageTooLargeToHash",
                        {
                            "size": size_to_hash,
                            "max_size": PKG_FROM_FOLDER_MAX_PKG_SIZE,
                        },
                    )

                files_to_hash += 1
                if files_to_hash > PKG_FROM_FOLDER_MAX_FILES:
                    raise PkgpushException(
                        "TooManyFilesToHash",
                        {
                            "num_files": files_to_hash,
                            "max_files": PKG_FROM_FOLDER_MAX_FILES,
                        },
                    )

        logger.info("pkg._validate_with_workflow")

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
    return PackagePushResult(top_hash=top_hash)
