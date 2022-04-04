"""
Overall performance of this function is mostly limited by hashing rate which is
limited by lambda's network throughput. Max network thoughput in
benchmarks was about 75 MiB/s. To overcome this limitation this function
concurrently invokes dedicated hash lambda for multiple files.
"""
import concurrent.futures
import contextlib
import functools
import json
import os
import tempfile
import traceback
from http import HTTPStatus

import boto3
import botocore.client
from botocore.exceptions import ClientError
from jsonschema import Draft7Validator

# Must be done before importing quilt3.
os.environ['QUILT_DISABLE_CACHE'] = 'true'  # noqa: E402
import quilt3
from quilt3.backends import get_package_registry
from quilt3.backends.s3 import S3PackageRegistryV1
from quilt3.util import PhysicalKey
from t4_lambda_shared.utils import LAMBDA_TMP_SPACE, get_quilt_logger

PROMOTE_PKG_MAX_MANIFEST_SIZE = int(os.environ['PROMOTE_PKG_MAX_MANIFEST_SIZE'])
PROMOTE_PKG_MAX_PKG_SIZE = int(os.environ['PROMOTE_PKG_MAX_PKG_SIZE'])
PROMOTE_PKG_MAX_FILES = int(os.environ['PROMOTE_PKG_MAX_FILES'])
PKG_FROM_FOLDER_MAX_PKG_SIZE = int(os.environ['PKG_FROM_FOLDER_MAX_PKG_SIZE'])
PKG_FROM_FOLDER_MAX_FILES = int(os.environ['PKG_FROM_FOLDER_MAX_FILES'])
S3_HASH_LAMBDA = os.environ['S3_HASH_LAMBDA']  # To dispatch separate, stack-created lambda function.
# CFN template guarantees S3_HASH_LAMBDA_CONCURRENCY concurrent invocation of S3 hash lambda without throttling.
S3_HASH_LAMBDA_CONCURRENCY = int(os.environ['S3_HASH_LAMBDA_CONCURRENCY'])
S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES = int(os.environ['S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES'])

S3_HASH_LAMBDA_SIGNED_URL_EXPIRES_IN_SECONDS = 15 * 60  # Max lambda duration.

SERVICE_BUCKET = os.environ['SERVICE_BUCKET']

PACKAGE_ID_PROPS = {
    'registry': {
        'type': 'string',
        'format': 'uri',
    },
    'name': {
        'type': 'string',
    },
}

PACKAGE_REV_LOCATION_SCHEMA = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'id': 'https://quiltdata.com/package-revision-location/1',
    'type': 'object',
    'properties': {
        **PACKAGE_ID_PROPS,
        'top_hash': {
            'type': 'string',
            'pattern': '^[0-9a-f]{64}$',
        }
    },
    'required': [
        *PACKAGE_ID_PROPS,
        'top_hash',
    ],
}

PACKAGE_BUILD_META_PROPS = {
    'message': {
        'type': 'string',
    },
    'meta': {
        'type': 'object',
    },
    'workflow': {
        'type': ['string', 'null']
    },
}

PACKAGE_PROMOTE_SCHEMA = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'type': 'object',
    'properties': {
        'parent': PACKAGE_REV_LOCATION_SCHEMA,
        **PACKAGE_ID_PROPS,
        **PACKAGE_BUILD_META_PROPS,
    },
    'required': [
        'parent',
        *PACKAGE_ID_PROPS,
    ],
}

PACKAGE_LOCATION_SCHEMA = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'id': 'https://quiltdata.com/package-location/1',
    'type': 'object',
    'properties': {
        **PACKAGE_ID_PROPS,
    },
    'required': list(PACKAGE_ID_PROPS),
    'additionalProperties': False,
}

PKG_FROM_FOLDER_SCHEMA = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'type': 'object',
    'properties': {
        'registry': {
            'type': 'string',
        },
        'entries': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'logical_key': {'type': 'string'},
                    'path': {'type': 'string'},
                    'is_dir': {'type': 'boolean'},
                },
                'required': ['logical_key', 'path', 'is_dir'],
            },
        },
        'dst': PACKAGE_LOCATION_SCHEMA,
        **PACKAGE_BUILD_META_PROPS,
    },
    'required': [
        'registry',
        'entries',
        'dst',
    ],
    'additionalProperties': False,
}


PACKAGE_CREATE_SCHEMA = {
    'type': 'object',
    'properties': {
        **PACKAGE_ID_PROPS,
        **PACKAGE_BUILD_META_PROPS,
    },
    'required': PACKAGE_ID_PROPS,
    'additionalProperties': False
}


PACKAGE_CREATE_ENTRY_SCHEMA = {
    'type': 'object',
    'properties': {
        'logical_key': {
            'type': 'string'
        },
        'physical_key': {
            'type': 'string'
        },
        'size': {
            'type': 'integer'
        },
        'hash': {
            'type': 'string'
        },
        'meta': {
            'type': 'object',
        },
    },
    'required': ['logical_key', 'physical_key'],
}


s3 = boto3.client('s3')
lambda_ = boto3.client('lambda')


# Monkey patch quilt3 S3ClientProvider, so it builds a client using user credentials.
user_boto_session = None
quilt3.data_transfer.S3ClientProvider.get_boto_session = staticmethod(lambda: user_boto_session)


logger = get_quilt_logger()


def calculate_pkg_hashes(boto_session, pkg):
    entries = []
    for lk, entry in pkg.walk():
        if entry.hash is not None:
            continue
        if entry.size > S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES:
            raise FileTooLargeForHashing(lk, entry.size, S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES)

        entries.append(entry)

    user_s3 = boto_session.client("s3")

    @functools.lru_cache(maxsize=None)
    def get_region_for_bucket(bucket: str) -> str:
        return user_s3.get_bucket_location(
            Bucket=bucket
        )["LocationConstraint"] or "us-east-1"

    @functools.lru_cache(maxsize=None)
    def get_s3_client_for_region(region: str):
        return boto_session.client("s3", region_name=region, config=botocore.client.Config(signature_version="s3v4"))

    def get_client_for_bucket(bucket: str):
        return get_s3_client_for_region(get_region_for_bucket(bucket))

    with concurrent.futures.ThreadPoolExecutor(max_workers=S3_HASH_LAMBDA_CONCURRENCY) as pool:
        fs = [
            pool.submit(calculate_pkg_entry_hash, get_client_for_bucket, entry)
            for entry in entries
        ]
        for f in concurrent.futures.as_completed(fs):
            f.result()


def calculate_pkg_entry_hash(get_client_for_bucket, pkg_entry):
    pk = pkg_entry.physical_key
    params = {
        'Bucket': pk.bucket,
        'Key': pk.path,
    }
    if pk.version_id is not None:
        params['VersionId'] = pk.version_id
    url = get_client_for_bucket(pk.bucket).generate_presigned_url(
        ClientMethod='get_object',
        ExpiresIn=S3_HASH_LAMBDA_SIGNED_URL_EXPIRES_IN_SECONDS,
        Params=params,
    )
    pkg_entry.hash = {
        'type': 'SHA256',
        'value': invoke_hash_lambda(url),
    }


def invoke_hash_lambda(url):
    resp = lambda_.invoke(FunctionName=S3_HASH_LAMBDA, Payload=json.dumps(url))
    if 'FunctionError' in resp:
        raise S3HashLambdaUnhandledError
    return json.load(resp['Payload'])


CREDENTIALS_ATTRS = (
    'aws_access_key_id',
    'aws_secret_access_key',
    'aws_session_token',
)


# XXX: use jsonschema?
def get_user_credentials(input):
    creds = {attr: input.get(attr) for attr in CREDENTIALS_ATTRS}
    if not all(creds.values()):
        raise InvalidCredentials()
    return creds


# Isolated for test-ability.
get_user_boto_session = boto3.session.Session


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
    def wrapper(event):
        with setup_user_boto_session(get_user_boto_session(**get_user_credentials(event["credentials"]))):
            return f(event["params"])
    return wrapper


class PkgpushException(Exception):
    def __init__(self, message, data=None):
        super().__init__(message, data)
        self.message = message
        self.data = data

    def asdict(self):
        return {
            "name": self.__class__.__name__,
            "message": self.message,
            "data": self.data,
        }

    def __str__(self):
        return f"{self.__class__.__name__}: {self.message}"


class S3HashLambdaUnhandledError(PkgpushException):
    def __init__(self):
        super().__init__("An error occured while calling S3 Hash Lambda.")


class InvalidCredentials(PkgpushException):
    def __init__(self):
        super().__init__(
            f"Invalid credentials: {', '.join(CREDENTIALS_ATTRS)} are required.",
        )


class InvalidInputParameters(PkgpushException):
    def __init__(self, ex):
        super().__init__(f"Invalid input parameters: {ex.message}")


class InvalidRegistry(PkgpushException):
    def __init__(self, registry_url):
        super().__init__(
            f"'{registry_url}' is not a valid S3 package registry.",
            {"registry_url": registry_url},
        )


class InvalidSuccessor(PkgpushException):
    def __init__(self, successor):
        super().__init__(
            f"{successor} is not configured as successor.",
            {"successor": successor},
        )


class PackageTooLargeToCopy(PkgpushException):
    def __init__(self, size, max_size):
        super().__init__(
            f"Total package size is {size}, but max supported size with `copy_data: true` is {max_size}",
            {"size": size, "max_size": max_size},
        )


class PackageTooLargeToHash(PkgpushException):
    def __init__(self, size, max_size):
        super().__init__(
            f"Total size of new S3 files is {size}, but max supported size is {max_size}",
            {"size": size, "max_size": max_size},
        )


class TooManyFilesToCopy(PkgpushException):
    def __init__(self, files, max_files):
        super().__init__(
            f"Package has {files} files, but max supported number with `copy_data: true` is {max_files}",
            {"files": files, "max_files": max_files},
        )


class TooManyFilesToHash(PkgpushException):
    def __init__(self, files, max_files):
        super().__init__(
            f"Package has {files} new S3 files, but max supported number is {max_files}",
            {"files": files, "max_files": max_files},
        )


class FileTooLargeForHashing(PkgpushException):
    def __init__(self, logical_key, size, max_size):
        super().__init__(
            (
                f"Package entry {logical_key!r} is too large for hashing. "
                f"Max size is {max_size} bytes."
            ),
            {
                "logical_key": logical_key,
                "size": size,
                "max_size": max_size,
            },
        )


class QuiltException(PkgpushException):
    def __init__(self, qe):
        super().__init__(qe.message)


class Forbidden(PkgpushException):
    pass


class ManifestTooLarge(PkgpushException):
    def __init__(self, size, max_size):
        super().__init__(
            f"Manifest size of {size} exceeds supported limit of {max_size}",
            {"size": size, "max_size": max_size},
        )


class ManifestHasLocalKeys(PkgpushException):
    def __init__(self):
        super().__init__("Parent's manifest contains non-S3 physical keys.")


class RequestTooLarge(PkgpushException):
    def __init__(self, size, max_size):
        super().__init__(
            f"Request file size is {size}, but max supported size is {max_size}.",
            {"size": size, "max_size": max_size},
        )


class InvalidS3PhysicalKey(PkgpushException):
    def __init__(self, physical_key):
        super().__init__(
            f"{physical_key} is not a valid s3 URL.",
            {"physical_key": physical_key},
        )


class InvalidLocalPhysicalKey(PkgpushException):
    def __init__(self, physical_key):
        super().__init__(
            f"{physical_key} is not in S3.",
            {"physical_key": physical_key},
        )


class AWSError(PkgpushException):
    def __init__(self, boto_error: ClientError):
        boto_response = boto_error.response
        status_code = boto_response["ResponseMetadata"]["HTTPStatusCode"]
        error_code = boto_response["Error"]["Code"]
        error_message = boto_response["Error"]["Message"]
        super().__init__(f"{error_code}: {error_message}", {
            "status_code": status_code,
            "error_code": error_code,
            "error_message": error_message,
        })


def exception_handler(f):
    @functools.wraps(f)
    def wrapper(event):
        try:
            return {"result": f(event)}
        except PkgpushException as e:
            traceback.print_exc()
            return {"error": e.asdict()}
    return wrapper


def get_schema_validator(schema):
    iter_errors = Draft7Validator(schema).iter_errors

    def validator(data):
        ex = next(iter_errors(data), None)
        # TODO: collect all errors
        if ex is not None:
            raise InvalidInputParameters(ex)
        return data

    return validator


def json_api(schema):
    validator = get_schema_validator(schema)

    def innerdec(f):
        @functools.wraps(f)
        def wrapper(params):
            validator(params)
            return f(params)
        return wrapper
    return innerdec


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


def get_registry(registry_url):
    package_registry = None
    try:
        package_registry = get_package_registry(registry_url)
    except quilt3.util.URLParseError:
        pass
    else:
        if not isinstance(package_registry, S3PackageRegistryV1):
            package_registry = None
    if package_registry is None:
        raise InvalidRegistry(registry_url)
    return package_registry


def _get_successor_params(registry, successor):
    workflow_config = registry.get_workflow_config()
    successors = workflow_config.config.get('successors') or {}
    for successor_url, successor_params in successors.items():
        if get_registry(successor_url) == successor:
            return successor_params
    raise InvalidSuccessor(successor.base)


def _push_pkg_to_successor(data, *, get_src, get_dst, get_name, get_pkg, pkg_max_size, pkg_max_files):
    dst_registry = get_registry(get_dst(data))
    src_registry = get_registry(get_src(data))
    copy_data = _get_successor_params(src_registry, dst_registry).get('copy_data', True)

    try:
        pkg = get_pkg(src_registry, data)
        if copy_data:
            total_size = 0
            total_files = 0
            for lk, e in pkg.walk():
                total_size += e.size
                if total_size > pkg_max_size:
                    raise PackageTooLargeToCopy(total_size, pkg_max_size)
                total_files += 1
                if total_files > pkg_max_files:
                    raise TooManyFilesToCopy(total_files, pkg_max_files)

        meta = data.get('meta')
        if meta is None:
            pkg._meta.pop('user_meta', None)
        else:
            pkg.set_meta(meta)

        result = pkg._push(
            name=get_name(data),
            registry=get_dst(data),
            message=data.get('message'),
            workflow=data.get('workflow', ...),
            selector_fn=None if copy_data else lambda *args: False,
            print_info=False,
        )
        return {'top_hash': result._origin.top_hash}
    except quilt3.util.QuiltException as qe:
        raise QuiltException(qe)
    except ClientError as boto_error:
        raise AWSError(boto_error)
    except quilt3.data_transfer.S3NoValidClientError as e:
        raise Forbidden(e.message)


@exception_handler
@auth
@json_api(PACKAGE_PROMOTE_SCHEMA)
@setup_telemetry
def promote_package(data):
    def get_pkg(src_registry, data):
        quilt3.util.validate_package_name(data['parent']['name'])
        manifest_pk = src_registry.manifest_pk(data['parent']['name'], data['parent']['top_hash'])
        manifest_size, version = quilt3.data_transfer.get_size_and_version(manifest_pk)
        if manifest_size > PROMOTE_PKG_MAX_MANIFEST_SIZE:
            raise ManifestTooLarge(manifest_size, PROMOTE_PKG_MAX_MANIFEST_SIZE)
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
            raise ManifestHasLocalKeys()
        return pkg

    return _push_pkg_to_successor(
        data,
        get_src=lambda data: data['parent']['registry'],
        get_dst=lambda data: data['registry'],
        get_name=lambda data: data['name'],
        get_pkg=get_pkg,
        pkg_max_size=PROMOTE_PKG_MAX_PKG_SIZE,
        pkg_max_files=PROMOTE_PKG_MAX_FILES,
    )


@exception_handler
@auth
@json_api(PKG_FROM_FOLDER_SCHEMA)
@setup_telemetry
def package_from_folder(data):
    def get_pkg(src_registry, data):
        p = quilt3.Package()
        for entry in data['entries']:
            set_entry = p.set_dir if entry['is_dir'] else p.set
            set_entry(entry['logical_key'], str(src_registry.base.join(entry['path'])))
        calculate_pkg_hashes(user_boto_session, p)
        return p

    return _push_pkg_to_successor(
        data,
        get_src=lambda data: data['registry'],
        get_dst=lambda data: data['dst']['registry'],
        get_name=lambda data: data['dst']['name'],
        get_pkg=get_pkg,
        pkg_max_size=PKG_FROM_FOLDER_MAX_PKG_SIZE,
        pkg_max_files=PKG_FROM_FOLDER_MAX_FILES,
    )


def large_request_handler(request_type):
    user_request_key = f'user-requests/{request_type}'

    def inner(f):
        @functools.wraps(f)
        def wrapper(version_id):
            size = s3.head_object(Bucket=SERVICE_BUCKET, Key=user_request_key, VersionId=version_id)['ContentLength']
            if size > LAMBDA_TMP_SPACE:
                raise RequestTooLarge(size, LAMBDA_TMP_SPACE)
            # download file with user request using lambda's role
            with tempfile.TemporaryFile() as tmp_file:
                s3.download_fileobj(
                    SERVICE_BUCKET,
                    user_request_key,
                    tmp_file,
                    ExtraArgs={'VersionId': version_id},
                )
                tmp_file.seek(0)
                result = f(tmp_file)
                try:
                    # TODO: rework this as context manager, to make sure object
                    # is deleted even when code above raises exception.
                    s3.delete_object(
                        Bucket=SERVICE_BUCKET,
                        Key=user_request_key,
                        VersionId=version_id,
                    )
                except Exception:
                    logger.exception('error while removing user request file from S3')
                return result
        return wrapper
    return inner


@exception_handler
@auth
@json_api({'type': 'string', 'minLength': 1, 'maxLength': 1024})
@large_request_handler('create-package')
@setup_telemetry
def create_package(req_file):
    json_iterator = map(json.JSONDecoder().decode, (line.decode() for line in req_file))

    data = next(json_iterator)
    get_schema_validator(PACKAGE_CREATE_SCHEMA)(data)
    handle = data['name']
    registry = data['registry']

    try:
        package_registry = get_registry(registry)

        meta = data.get('meta')
        message = data.get('message')
        quilt3.util.validate_package_name(handle)
        pkg = quilt3.Package()
        if meta is not None:
            pkg.set_meta(meta)

        size_to_hash = 0
        files_to_hash = 0
        for entry in map(get_schema_validator(PACKAGE_CREATE_ENTRY_SCHEMA), json_iterator):
            try:
                physical_key = PhysicalKey.from_url(entry['physical_key'])
            except ValueError:
                raise InvalidS3PhysicalKey(entry['physical_key'])
            if physical_key.is_local():
                raise InvalidLocalPhysicalKey(str(physical_key))
            logical_key = entry['logical_key']

            hash_ = entry.get('hash')
            obj_size = entry.get('size')
            meta = entry.get('meta')

            if hash_ and obj_size is not None:
                pkg.set(
                    logical_key,
                    quilt3.packages.PackageEntry(
                        physical_key,
                        obj_size,
                        {'type': 'SHA256', 'value': hash_},
                        meta,
                    )
                )
            else:
                pkg.set(logical_key, str(physical_key), meta)

                size_to_hash += pkg[logical_key].size
                if size_to_hash > PKG_FROM_FOLDER_MAX_PKG_SIZE:
                    raise PackageTooLargeToHash(size_to_hash, PKG_FROM_FOLDER_MAX_PKG_SIZE)

                files_to_hash += 1
                if files_to_hash > PKG_FROM_FOLDER_MAX_FILES:
                    raise TooManyFilesToHash(files_to_hash, PKG_FROM_FOLDER_MAX_FILES)

        pkg._validate_with_workflow(
            registry=package_registry,
            workflow=data.get('workflow', ...),
            name=handle,
            message=message,
        )

    except quilt3.util.QuiltException as qe:
        raise QuiltException(qe)

    calculate_pkg_hashes(user_boto_session, pkg)
    try:
        top_hash = pkg._build(
            name=handle,
            registry=registry,
            message=message,
        )
    except ClientError as boto_error:
        raise AWSError(boto_error)

    # XXX: return mtime?
    return {'top_hash': top_hash}
