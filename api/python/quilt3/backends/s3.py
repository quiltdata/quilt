import os
from enum import Enum
from urllib.parse import quote, urlencode, urlunparse

import boto3
from botocore import UNSIGNED
from botocore.config import Config
from botocore.exceptions import ClientError
from s3transfer.utils import signal_not_transferring, signal_transferring

from quilt3.session import create_botocore_session
from quilt3.util import PhysicalKey

from .base import PackageRegistryV1, PackageRegistryV2


class S3Api(Enum):
    GET_OBJECT = "GET_OBJECT"
    HEAD_OBJECT = "HEAD_OBJECT"
    LIST_OBJECT_VERSIONS = "LIST_OBJECT_VERSIONS"
    LIST_OBJECTS_V2 = "LIST_OBJECTS_V2"


class S3NoValidClientError(Exception):
    def __init__(self, message, **kwargs):
        # We use NewError("Prefix: " + str(error)) a lot.
        # To be consistent across Python 2.7 and 3.x:
        # 1) This `super` call must exist, or 2.7 will have no text for str(error)
        # 2) This `super` call must have only one argument (the message) or str(error) will be a repr of args
        super().__init__(message)
        self.message = message
        for k, v in kwargs.items():
            setattr(self, k, v)


class S3ClientProvider:
    """
    An s3_client is either signed with standard credentials or unsigned. This class exists to dynamically provide the
    correct s3 client (either standard_client or unsigned_client) for a bucket. This means if standard credentials
    can't read from the bucket, check if the bucket is public in which case we should be using an unsigned client.
    This check is expensive at scale so the class also keeps track of which client to use for each bucket+api_call.

    If there are no credentials available at all (i.e. you don't have AWS credentials and you don't have a
    Quilt-provided role from quilt3.login()), the standard client will also be unsigned so that users can still
    access public s3 buckets.

    We assume that public buckets are read-only: write operations should always use S3ClientProvider.standard_client
    """

    def __init__(self):
        self._use_unsigned_client = {}  # f'{action}/{bucket}' -> use_unsigned_client_bool
        self._standard_client = None
        self._unsigned_client = None

    @property
    def standard_client(self):
        if self._standard_client is None:
            self._build_standard_client()
        return self._standard_client

    @property
    def unsigned_client(self):
        if self._unsigned_client is None:
            self._build_unsigned_client()
        return self._unsigned_client

    def get_correct_client(self, action: S3Api, bucket: str):
        if not self.client_type_known(action, bucket):
            raise RuntimeError("get_correct_client was called, but the correct client type is not known. Only call "
                               "get_correct_client() after checking if client_type_known()")

        if self.should_use_unsigned_client(action, bucket):
            return self.unsigned_client
        else:
            return self.standard_client

    def key(self, action: S3Api, bucket: str):
        return f"{action}/{bucket}"

    def set_cache(self, action: S3Api, bucket: str, use_unsigned: bool):
        self._use_unsigned_client[self.key(action, bucket)] = use_unsigned

    def should_use_unsigned_client(self, action: S3Api, bucket: str):
        # True if should use unsigned, False if should use standard, None if don't know yet
        return self._use_unsigned_client.get(self.key(action, bucket))

    def client_type_known(self, action: S3Api, bucket: str):
        return self.should_use_unsigned_client(action, bucket) is not None

    def find_correct_client(self, api_type, bucket, param_dict):
        if self.client_type_known(api_type, bucket):
            return self.get_correct_client(api_type, bucket)
        else:
            check_fn_mapper = {
                S3Api.GET_OBJECT: check_get_object_works_for_client,
                S3Api.HEAD_OBJECT: check_head_object_works_for_client,
                S3Api.LIST_OBJECTS_V2: check_list_objects_v2_works_for_client,
                S3Api.LIST_OBJECT_VERSIONS: check_list_object_versions_works_for_client
            }
            assert api_type in check_fn_mapper.keys(), f"Only certain APIs are supported with unsigned_client. The " \
                f"API '{api_type}' is not current supported. You may want to use S3ClientProvider.standard_client " \
                f"instead "
            check_fn = check_fn_mapper[api_type]
            if check_fn(self.standard_client, param_dict):
                self.set_cache(api_type, bucket, use_unsigned=False)
                return self.standard_client
            else:
                if check_fn(self.unsigned_client, param_dict):
                    self.set_cache(api_type, bucket, use_unsigned=True)
                    return self.unsigned_client
                else:
                    raise S3NoValidClientError(f"S3 AccessDenied for {api_type} on bucket: {bucket}")

    def get_boto_session(self):
        botocore_session = create_botocore_session()
        boto_session = boto3.Session(botocore_session=botocore_session)
        return boto_session

    def register_signals(self, s3_client):
        # Enable/disable file read callbacks when uploading files.
        # Copied from https://github.com/boto/s3transfer/blob/develop/s3transfer/manager.py#L501
        event_name = 'request-created.s3'
        s3_client.meta.events.register_first(
                event_name, signal_not_transferring,
                unique_id='datatransfer-not-transferring')
        s3_client.meta.events.register_last(
                event_name, signal_transferring,
                unique_id='datatransfer-transferring')

    def _build_client(self, get_config):
        session = self.get_boto_session()
        return session.client('s3', config=get_config(session))

    def _build_standard_client(self):
        s3_client = self._build_client(
            lambda session:
                Config(signature_version=UNSIGNED)
                if session.get_credentials() is None
                else None
        )
        self.register_signals(s3_client)
        self._standard_client = s3_client

    def _build_unsigned_client(self):
        s3_client = self._build_client(lambda session: Config(signature_version=UNSIGNED))
        self.register_signals(s3_client)
        self._unsigned_client = s3_client


def check_list_object_versions_works_for_client(s3_client, params):
    try:
        s3_client.list_object_versions(**params, MaxKeys=1)  # Make this as fast as possible
    except ClientError as e:
        return e.response["Error"]["Code"] != "AccessDenied"
    return True


def check_list_objects_v2_works_for_client(s3_client, params):
    try:
        s3_client.list_objects_v2(**params, MaxKeys=1)  # Make this as fast as possible
    except ClientError as e:
        if e.response["Error"]["Code"] == "AccessDenied":
            return False
    return True


def check_get_object_works_for_client(s3_client, params):
    try:
        head_args = dict(
                Bucket=params["Bucket"],
                Key=params["Key"]
        )
        if "VersionId" in params:
            head_args["VersionId"] = params["VersionId"]

        s3_client.head_object(**head_args)  # HEAD/GET share perms, but HEAD always fast
    except ClientError as e:
        if e.response["Error"]["Code"] == "403":
            # This can also happen if you have full get_object access, but not list_objects_v2, and the object does not
            # exist. Instead of returning a 404, S3 will return a 403.
            return False

    return True


def check_head_object_works_for_client(s3_client, params):
    try:
        s3_client.head_object(**params)
    except ClientError as e:
        if e.response["Error"]["Code"] == "403":
            # This can also happen if you have full get_object access, but not list_objects_v2, and the object does not
            # exist. Instead of returning a 404, S3 will return a 403.
            return False
    return True


class S3PhysicalKey(PhysicalKey):
    __slots__ = ('bucket', 'path', 'version_id')

    def __init__(self, bucket, path, version_id):
        assert bucket is None or isinstance(bucket, str)
        assert isinstance(path, str)
        assert not path.startswith('/'), "S3 paths must not start with '/'"
        assert version_id is None or isinstance(version_id, str)

        self.bucket = bucket
        self.path = path
        self.version_id = version_id

    def __eq__(self, other):
        return (
            isinstance(other, self.__class__) and
            self.bucket == other.bucket and
            self.path == other.path and
            self.version_id == other.version_id
        )

    def __repr__(self):
        return f'{self.__class__.__name__}({self.bucket!r}, {self.path!r}, {self.version_id!r})'

    def __str__(self):
        if self.version_id is None:
            params = {}
        else:
            params = {'versionId': self.version_id}
        return urlunparse(('s3', self.bucket, quote(self.path), None, urlencode(params), None))

    def join(self, rel_path):
        if self.version_id is not None:
            raise ValueError('Cannot append paths to URLs with a version ID')

        if os.name == 'nt' and '\\' in rel_path:
            raise ValueError("Paths must use / as a separator")

        if self.path:
            new_path = self.path.rstrip('/') + '/' + rel_path.lstrip('/')
        else:
            new_path = rel_path.lstrip('/')

        return self.__class__(self.bucket, new_path, None)

    def _s3_query_object(self, *, head=False):
        params = dict(Bucket=self.bucket, Key=self.path)
        if self.version_id is not None:
            params.update(VersionId=self.version_id)
        s3_client = S3ClientProvider().find_correct_client(
            S3Api.HEAD_OBJECT if head else S3Api.GET_OBJECT, self.bucket, params)
        return (s3_client.head_object if head else s3_client.get_object)(**params)

    def get_bytes(self):
        return self._s3_query_object()['Body'].read()

    def _put_bytes(self, data):
        if self.version_id is not None:
            raise ValueError("Cannot set VersionId on destination")
        s3_client = S3ClientProvider().standard_client
        s3_client.put_object(
            Bucket=self.bucket,
            Key=self.path,
            Body=data,
        )

    def list_url(self):
        if self.version_id is not None:
            raise ValueError(f"Directories cannot have version IDs: {self}")
        src_path = self.path
        if not self._looks_like_dir():
            src_path += '/'
        for response in s3_list_objects(Bucket=self.bucket, Prefix=src_path):
            for obj in response.get('Contents', []):
                key = obj['Key']
                if not key.startswith(src_path):
                    raise ValueError("Unexpected key: %r" % key)
                yield key[len(src_path):], obj['Size']

    def delete_url(self):
        s3_client = S3ClientProvider().standard_client
        s3_client.delete_object(Bucket=self.bucket, Key=self.path)


def s3_list_objects(**kwargs):
    s3_client = S3ClientProvider().find_correct_client(S3Api.LIST_OBJECTS_V2, kwargs['Bucket'], kwargs)
    return s3_client.get_paginator('list_objects_v2').paginate(**kwargs)


def delete_url_recursively(src: PhysicalKey):
    s3_client = S3ClientProvider().standard_client
    for resp in s3_list_objects(Bucket=src.bucket, Prefix=src.path):
        for key in resp.get('Contents', ()):
            s3_client.delete_object(Bucket=src.bucket, Key=key['Key'])


class S3PackageRegistryV1(PackageRegistryV1):
    def list_packages(self):
        prev_pkg = None
        for path, _ in self.pointers_global_dir.list_url():
            pkg = path.rpartition('/')[0]
            # A package can have multiple versions, but we should only return the name once.
            if pkg != prev_pkg:
                prev_pkg = pkg
                yield pkg

    def list_package_pointers(self, pkg_name: str):
        package_dir = self.pointers_dir(pkg_name)
        for path, _ in package_dir.list_url():
            pkg_hash = package_dir.join(path).get_bytes()
            yield path, pkg_hash.decode().strip()

    def delete_package(self, pkg_name: str):
        delete_url_recursively(self.pointers_dir(pkg_name))


class S3PackageRegistryV2(PackageRegistryV2):
    def list_packages(self):
        prefix = self.manifests_global_dir.path
        prefix_len = len(prefix)
        for resp in s3_list_objects(
            Bucket=self.manifests_global_dir.bucket,
            Prefix=prefix,
            Delimiter='/',
        ):
            for obj in resp.get('CommonPrefixes', ()):
                yield obj['Prefix'][prefix_len:-1].replace('@', '/')

    list_package_pointers = S3PackageRegistryV1.list_package_pointers

    def list_package_versions_with_timestamps(self, pkg_name: str):
        manifest_dir_pk = self.manifests_package_dir(pkg_name)
        prefix = manifest_dir_pk.path
        s = slice(len(prefix), None)
        for response in s3_list_objects(Bucket=manifest_dir_pk.bucket, Prefix=prefix):
            for obj in response.get('Contents', ()):
                yield obj['LastModified'], self._top_hash_from_path(obj['Key'][s])

    def delete_package(self, pkg_name: str):
        delete_url_recursively(self.manifests_package_dir(pkg_name))
        delete_url_recursively(self.pointers_dir(pkg_name))


def get_package_registry(version: int):
    if version == 1:
        return S3PackageRegistryV1
    if version == 2:
        return S3PackageRegistryV2
    raise ValueError()
