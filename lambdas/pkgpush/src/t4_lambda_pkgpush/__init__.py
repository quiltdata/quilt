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
from botocore.exceptions import ClientError
from jsonschema import Draft7Validator

# Must be done before importing quilt3.
os.environ['QUILT_DISABLE_CACHE'] = 'true'  # noqa: E402
import quilt3
from quilt3.backends import get_package_registry
from quilt3.backends.s3 import S3PackageRegistryV1
from quilt3.util import PhysicalKey
from t4_lambda_shared.decorator import ELBRequest, api
from t4_lambda_shared.utils import (
    LAMBDA_TMP_SPACE,
    get_default_origins,
    get_quilt_logger,
    make_json_response,
)

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
            raise FileTooLargeForHashing(lk)

        entries.append(entry)

    user_s3 = boto_session.client("s3")

    @functools.lru_cache(maxsize=None)
    def get_region_for_bucket(bucket: str) -> str:
        return user_s3.get_bucket_location(
            Bucket=bucket
        )["LocationConstraint"] or "us-east-1"

    @functools.lru_cache(maxsize=None)
    def get_s3_client_for_region(region: str):
        return boto_session.client("s3", region_name=region)

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


class S3HashLambdaUnhandledError(Exception):
    pass


def invoke_hash_lambda(url):
    resp = lambda_.invoke(FunctionName=S3_HASH_LAMBDA, Payload=json.dumps(url))
    if 'FunctionError' in resp:
        raise S3HashLambdaUnhandledError
    return json.load(resp['Payload'])


def get_user_credentials(request):
    attrs_map = (
        ('access_key', 'aws_access_key_id'),
        ('secret_key', 'aws_secret_access_key'),
        ('session_token', 'aws_session_token'),
    )
    creds = {
        dst: request.args.get(src)
        for src, dst in attrs_map
    }
    if not all(creds.values()):
        raise ApiException(
            HTTPStatus.BAD_REQUEST,
            f'{", ".join(dict(attrs_map))} are required.'
        )
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
    def wrapper(request):
        with setup_user_boto_session(get_user_boto_session(**get_user_credentials(request))):
            return f(request)
    return wrapper


class ApiException(Exception):
    def __init__(self, status_code, message):
        super().__init__()
        self.status_code = status_code
        self.message = message

    @classmethod
    def from_botocore_error(cls, boto_error: ClientError):
        boto_response = boto_error.response
        status_code = boto_response['ResponseMetadata']['HTTPStatusCode']
        message = "{0}: {1}".format(
            boto_response['Error']['Code'],
            boto_response['Error']['Message']
        )
        return cls(status_code, message)


class FileTooLargeForHashing(ApiException):
    def __init__(self, logical_key):
        super().__init__(
            HTTPStatus.BAD_REQUEST,
            f'Package entry {logical_key!r} is too large for hashing. '
            f'Max size is {S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES} bytes.'
        )


def api_exception_handler(f):
    @functools.wraps(f)
    def wrapper(request):
        try:
            return f(request)
        except ApiException as e:
            traceback.print_exc()
            return (
                e.status_code,
                json.dumps({'message': e.message}),
                {'content-type': 'application/json'},
            )
    return wrapper


def get_schema_validator(schema):
    iter_errors = Draft7Validator(schema).iter_errors

    def validator(data):
        ex = next(iter_errors(data), None)
        if ex is not None:
            raise ApiException(HTTPStatus.BAD_REQUEST, ex.message)
        return data

    return validator


def json_api(schema):
    validator = get_schema_validator(schema)

    def innerdec(f):
        @functools.wraps(f)
        def wrapper(request):
            request.data = json.loads(request.data)
            validator(request.data)
            return f(request)
        return wrapper
    return innerdec


def setup_telemetry(f):
    @functools.wraps(f)
    def wrapper(request):
        try:
            return f(request)
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
        raise ApiException(HTTPStatus.BAD_REQUEST, f"{registry_url} is not a valid S3 package registry.")
    return package_registry


def _get_successor_params(registry, successor):
    workflow_config = registry.get_workflow_config()
    successors = workflow_config.config.get('successors') or {}
    for successor_url, successor_params in successors.items():
        if get_registry(successor_url) == successor:
            return successor_params
    raise ApiException(HTTPStatus.BAD_REQUEST, f"{successor.base} is not configured as successor.")


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
                    raise ApiException(
                        HTTPStatus.BAD_REQUEST,
                        f"Total package size is {total_size}, "
                        f"but max supported size with `copy_data: true` is {pkg_max_size}"
                    )
                total_files += 1
                if total_files > pkg_max_files:
                    raise ApiException(
                        HTTPStatus.BAD_REQUEST,
                        f"Package has {total_files} files, "
                        f"but max supported number with `copy_data: true` is {pkg_max_files}"
                    )
        meta = data.get('meta')
        if meta is None:
            pkg._meta.pop('user_meta', None)
        else:
            pkg.set_meta(meta)
        return make_json_response(200, {
            'top_hash': pkg._push(
                name=get_name(data),
                registry=get_dst(data),
                message=data.get('message'),
                workflow=data.get('workflow', ...),
                selector_fn=None if copy_data else lambda *args: False,
                print_info=False,
            )._origin.top_hash,
        }, add_status=True)
    except quilt3.util.QuiltException as qe:
        raise ApiException(HTTPStatus.BAD_REQUEST, qe.message)
    except ClientError as boto_error:
        raise ApiException.from_botocore_error(boto_error)
    except quilt3.data_transfer.S3NoValidClientError as e:
        raise ApiException(HTTPStatus.FORBIDDEN, e.message)


@api(cors_origins=get_default_origins(), request_class=ELBRequest)
@api_exception_handler
@auth
@json_api(PACKAGE_PROMOTE_SCHEMA)
@setup_telemetry
def promote_package(request):
    data = request.data

    def get_pkg(src_registry, data):
        quilt3.util.validate_package_name(data['parent']['name'])
        manifest_pk = src_registry.manifest_pk(data['parent']['name'], data['parent']['top_hash'])
        manifest_size, version = quilt3.data_transfer.get_size_and_version(manifest_pk)
        if manifest_size > PROMOTE_PKG_MAX_MANIFEST_SIZE:
            raise ApiException(
                HTTPStatus.BAD_REQUEST,
                f"Manifest size of {manifest_size} exceeds supported limit of {PROMOTE_PKG_MAX_MANIFEST_SIZE}"
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
            raise ApiException(HTTPStatus.BAD_REQUEST, "Parent's manifest contains non-S3 physical keys.")
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


@api(cors_origins=get_default_origins(), request_class=ELBRequest)
@api_exception_handler
@auth
@json_api(PKG_FROM_FOLDER_SCHEMA)
@setup_telemetry
def package_from_folder(request):
    data = request.data

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
        def wrapper(request):
            version_id = request.data
            size = s3.head_object(Bucket=SERVICE_BUCKET, Key=user_request_key, VersionId=version_id)['ContentLength']
            if size > LAMBDA_TMP_SPACE:
                raise ApiException(
                    HTTPStatus.BAD_REQUEST,
                    f'Request file size is {size}, '
                    f'but max supported size is {LAMBDA_TMP_SPACE}.'
                )
            # download file with user request using lambda's role
            with tempfile.TemporaryFile() as tmp_file:
                s3.download_fileobj(
                    SERVICE_BUCKET,
                    user_request_key,
                    tmp_file,
                    ExtraArgs={'VersionId': version_id},
                )
                tmp_file.seek(0)
                request.stream = tmp_file
                result = f(request)
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


@api(cors_origins=get_default_origins(), request_class=ELBRequest)
@api_exception_handler
@auth
@json_api({'type': 'string', 'minLength': 1, 'maxLength': 1024})
@large_request_handler('create-package')
@setup_telemetry
def create_package(request):
    json_iterator = map(json.JSONDecoder().decode, (line.decode() for line in request.stream))

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
                raise ApiException(HTTPStatus.BAD_REQUEST, f"{entry['physical_key']} is not a valid s3 URL.")
            if physical_key.is_local():
                raise ApiException(HTTPStatus.BAD_REQUEST, f"{str(physical_key)} is not in S3.")
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
                    raise ApiException(
                        HTTPStatus.BAD_REQUEST,
                        f"Total size of new S3 files is {size_to_hash}, "
                        f"but max supported size is {PKG_FROM_FOLDER_MAX_PKG_SIZE}"
                    )

                files_to_hash += 1
                if files_to_hash > PKG_FROM_FOLDER_MAX_FILES:
                    raise ApiException(
                        HTTPStatus.BAD_REQUEST,
                        f"Package has new S3 {files_to_hash} files, "
                        f"but max supported number is {PKG_FROM_FOLDER_MAX_FILES}"
                    )

        pkg._validate_with_workflow(
            registry=package_registry,
            workflow=data.get('workflow', ...),
            name=handle,
            message=message,
        )

    except quilt3.util.QuiltException as qe:
        raise ApiException(HTTPStatus.BAD_REQUEST, qe.message)

    calculate_pkg_hashes(user_boto_session, pkg)
    try:
        top_hash = pkg._build(
            name=handle,
            registry=registry,
            message=message,
        )
    except ClientError as boto_error:
        raise ApiException.from_botocore_error(boto_error)

    return make_json_response(200, {
        'top_hash': top_hash,
    })
