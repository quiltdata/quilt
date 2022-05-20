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

CREDENTIALS_SCHEMA = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'id': 'https://quiltdata.com/aws-credentials/1',
    'type': 'object',
    'properties': {
        'aws_access_key_id': {'type': 'string', 'pattern': '^.+$'},
        'aws_secret_access_key': {'type': 'string', 'pattern': '^.+$'},
        'aws_session_token': {'type': 'string', 'pattern': '^.+$'},
    },
    'required': [
        'aws_access_key_id',
        'aws_secret_access_key',
        'aws_session_token',
    ],
}

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


class PkgpushException(Exception):
    def __init__(self, name, context=None):
        super().__init__(name, context)
        self.name = name
        self.context = context

    def asdict(self):
        return {"name": self.name, "context": self.context}

    @classmethod
    def from_boto_error(cls, boto_error: ClientError):
        boto_response = boto_error.response
        status_code = boto_response["ResponseMetadata"]["HTTPStatusCode"]
        error_code = boto_response["Error"]["Code"]
        error_message = boto_response["Error"]["Message"]
        return cls("AWSError", {
            "status_code": status_code,
            "error_code": error_code,
            "error_message": error_message,
        })

    @classmethod
    def from_quilt_exception(cls, qe: quilt3.util.QuiltException):
        name = (
            "WorkflowValidationError"
            if isinstance(qe, quilt3.workflows.WorkflowValidationError)
            else "QuiltException"
        )
        return cls(name, {"details": qe.message})


def calculate_pkg_hashes(boto_session, pkg):
    entries = []
    for lk, entry in pkg.walk():
        if entry.hash is not None:
            continue
        if entry.size > S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES:
            raise PkgpushException("FileTooLargeForHashing", {
                "logical_key": lk,
                "size": entry.size,
                "max_size": S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES,
            })

        entries.append(entry)

    user_s3 = boto_session.client("s3")

    @functools.lru_cache(maxsize=None)
    def get_region_for_bucket(bucket: str) -> str:
        try:
            resp = user_s3.head_bucket(Bucket=bucket)
        except botocore.exceptions.ClientError as e:
            resp = e.response
            if resp["Error"]["Code"] == "404":
                raise
        return resp["ResponseMetadata"]["HTTPHeaders"]["x-amz-bucket-region"]

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
        raise PkgpushException('S3HashLambdaUnhandledError')
    return json.load(resp['Payload'])


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
    validator = Draft7Validator(CREDENTIALS_SCHEMA)

    @functools.wraps(f)
    def wrapper(event):
        credentials = event.get("credentials")
        # TODO: collect all errors
        ex = next(validator.iter_errors(credentials), None)
        if ex is not None:
            raise PkgpushException("InvalidCredentials", {"details": ex.message})

        with setup_user_boto_session(get_user_boto_session(**credentials)):
            return f(event.get("params"))
    return wrapper


def exception_handler(f):
    @functools.wraps(f)
    def wrapper(event, _context):
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
            raise PkgpushException("InvalidInputParameters", {"details": ex.message})
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
        raise PkgpushException("InvalidRegistry", {"registry_url": registry_url})
    return package_registry


def _get_successor_params(registry, successor):
    workflow_config = registry.get_workflow_config()
    successors = workflow_config.config.get('successors') or {}
    for successor_url, successor_params in successors.items():
        if get_registry(successor_url) == successor:
            return successor_params
    raise PkgpushException("InvalidSuccessor", {"successor": str(successor.base)})


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
        raise PkgpushException.from_quilt_exception(qe)
    except ClientError as boto_error:
        raise PkgpushException.from_boto_error(boto_error)
    except quilt3.data_transfer.S3NoValidClientError as e:
        raise PkgpushException("Forbidden", {"details": e.message})


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
            raise PkgpushException("ManifestTooLarge", {
                "size": manifest_size,
                "max_size": PROMOTE_PKG_MAX_MANIFEST_SIZE,
            })
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
                raise PkgpushException(
                    "InvalidS3PhysicalKey",
                    {"physical_key": entry['physical_key']},
                )
            if physical_key.is_local():
                raise PkgpushException(
                    "InvalidLocalPhysicalKey",
                    {"physical_key": str(physical_key)},
                )
            logical_key = entry['logical_key']

            hash_ = entry.get('hash')
            obj_size = entry.get('size')
            meta = entry.get('meta')

            if hash_ and obj_size is not None:
                pkg.set(
                    logical_key,
                    quilt3.packages.PackageEntry(
                        physical_key,
                        None if obj_size is None else int(obj_size),
                        {'type': 'SHA256', 'value': hash_},
                        meta,
                    )
                )
            else:
                pkg.set(logical_key, str(physical_key), meta)

                size_to_hash += pkg[logical_key].size
                if size_to_hash > PKG_FROM_FOLDER_MAX_PKG_SIZE:
                    raise PkgpushException(
                        "PackageTooLargeToHash",
                        {"size": size_to_hash, "max_size": PKG_FROM_FOLDER_MAX_PKG_SIZE},
                    )

                files_to_hash += 1
                if files_to_hash > PKG_FROM_FOLDER_MAX_FILES:
                    raise PkgpushException(
                        "TooManyFilesToHash",
                        {"num_files": files_to_hash, "max_files": PKG_FROM_FOLDER_MAX_FILES},
                    )

        pkg._validate_with_workflow(
            registry=package_registry,
            workflow=data.get('workflow', ...),
            name=handle,
            message=message,
        )

    except quilt3.util.QuiltException as qe:
        raise PkgpushException.from_quilt_exception(qe)

    calculate_pkg_hashes(user_boto_session, pkg)
    try:
        top_hash = pkg._build(
            name=handle,
            registry=registry,
            message=message,
        )
    except ClientError as boto_error:
        raise PkgpushException.from_boto_error(boto_error)

    # XXX: return mtime?
    return {'top_hash': top_hash}
