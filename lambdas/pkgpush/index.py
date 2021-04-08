import contextlib
import functools
import json
import os
import tempfile
import traceback
from http import HTTPStatus

import boto3
import requests
from botocore.exceptions import ClientError
from jsonschema import Draft7Validator

# Must be done before importing quilt3.
os.environ['QUILT_DISABLE_CACHE'] = 'true'  # noqa: E402
import quilt3
from quilt3.backends import get_package_registry
from quilt3.backends.s3 import S3PackageRegistryV1
from quilt3.util import PhysicalKey
from t4_lambda_shared.decorator import api
from t4_lambda_shared.utils import get_default_origins, make_json_response

AUTH_ENDPOINT = os.environ['AUTH_ENDPOINT']

PROMOTE_PKG_MAX_MANIFEST_SIZE = int(os.environ['PROMOTE_PKG_MAX_MANIFEST_SIZE'])
PROMOTE_PKG_MAX_PKG_SIZE = int(os.environ['PROMOTE_PKG_MAX_PKG_SIZE'])
PROMOTE_PKG_MAX_FILES = int(os.environ['PROMOTE_PKG_MAX_FILES'])
PKG_FROM_FOLDER_MAX_PKG_SIZE = int(os.environ['PKG_FROM_FOLDER_MAX_PKG_SIZE'])
PKG_FROM_FOLDER_MAX_FILES = int(os.environ['PKG_FROM_FOLDER_MAX_FILES'])

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


# Monkey patch quilt3 S3ClientProvider, so it builds a client using user credentials.
user_boto_session = None
quilt3.data_transfer.S3ClientProvider.get_boto_session = staticmethod(lambda: user_boto_session)


def get_user_credentials(token):
    resp = requests.get(AUTH_ENDPOINT, headers={'Authorization': token})
    creds = resp.json()
    return {
        'aws_access_key_id': creds['AccessKeyId'],
        'aws_secret_access_key': creds['SecretAccessKey'],
        'aws_session_token': creds['SessionToken'],
    }


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
        auth_header = request.headers.get('authorization')
        if not auth_header:
            return HTTPStatus.UNAUTHORIZED, '', {}
        with setup_user_boto_session(get_user_boto_session(**get_user_credentials(auth_header))):
            return f(request)
    return wrapper


class ApiException(Exception):
    def __init__(self, status_code, message):
        super().__init__()
        self.status_code = status_code
        self.message = message


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


def json_api(schema):
    @functools.lru_cache(maxsize=None)
    def get_schema_validator():
        iter_errors = Draft7Validator(schema).iter_errors
        return lambda data: next(iter_errors(data), None)

    def innerdec(f):
        @functools.wraps(f)
        def wrapper(request):
            request.data = json.loads(request.data)
            ex = get_schema_validator()(request.data)
            if ex is not None:
                raise ApiException(HTTPStatus.BAD_REQUEST, ex.message)
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
    workflow_validator = registry.get_workflow_validator()
    successors = workflow_validator.config.get('successors') or {}
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
        boto_response = boto_error.response
        status_code = boto_response['ResponseMetadata']['HTTPStatusCode']
        message = "{0}: {1}".format(
            boto_response['Error']['Code'],
            boto_response['Error']['Message']
        )
        raise ApiException(status_code, message)
    except quilt3.data_transfer.S3NoValidClientError as e:
        raise ApiException(HTTPStatus.FORBIDDEN, e.message)


@api(cors_origins=get_default_origins())
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


@api(cors_origins=get_default_origins())
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
