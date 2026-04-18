from __future__ import annotations

import datetime
import functools
import json
import os

import boto3
import botocore.config

ROLE_MAP_ENV = "QUILT_CROSS_ACCOUNT_ROLE_MAP"
_REFRESH_MARGIN = datetime.timedelta(minutes=5)
_ASSUMED_CLIENT_CACHE: dict[tuple[str, str | None], tuple[datetime.datetime, object]] = {}


@functools.cache
def get_role_map() -> dict[str, str]:
    raw = os.getenv(ROLE_MAP_ENV, "{}")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(tz=datetime.timezone.utc)


def _assumed_bucket_client(role_arn: str, user_agent_extra: str | None):
    cache_key = (role_arn, user_agent_extra)
    cached = _ASSUMED_CLIENT_CACHE.get(cache_key)
    if cached and cached[0] - _REFRESH_MARGIN > _utcnow():
        return cached[1]

    sts = boto3.client("sts")
    assume_role_resp = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName="quilt-cross-account-indexer",
    )
    creds = assume_role_resp["Credentials"]
    client = boto3.session.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
    ).client(
        "s3",
        config=botocore.config.Config(user_agent_extra=user_agent_extra) if user_agent_extra else None,
    )
    _ASSUMED_CLIENT_CACHE[cache_key] = (creds["Expiration"], client)
    return client


class BucketRoleAwareS3Client:
    def __init__(self, *, user_agent_extra: str | None = None):
        self._user_agent_extra = user_agent_extra
        self._bucket_arg_indexes: dict[str, int | None] = {}
        self._default_client = boto3.client(
            "s3",
            config=botocore.config.Config(user_agent_extra=user_agent_extra) if user_agent_extra else None,
        )

    def _client_for_bucket(self, bucket: str | None):
        if not bucket:
            return self._default_client
        role_arn = get_role_map().get(bucket)
        if not role_arn:
            return self._default_client
        return _assumed_bucket_client(role_arn, self._user_agent_extra)

    def _bucket_arg_index(self, method_name: str) -> int | None:
        if method_name not in self._bucket_arg_indexes:
            api_name = self._default_client.meta.method_to_api_mapping.get(method_name)
            if not api_name:
                self._bucket_arg_indexes[method_name] = None
            else:
                input_shape = self._default_client.meta.service_model.operation_model(api_name).input_shape
                if not input_shape:
                    self._bucket_arg_indexes[method_name] = None
                else:
                    self._bucket_arg_indexes[method_name] = next(
                        (
                            index
                            for index, member_name in enumerate(input_shape.members)
                            if member_name == "Bucket"
                        ),
                        None,
                    )
        return self._bucket_arg_indexes[method_name]

    def __getattr__(self, name):
        attr = getattr(self._default_client, name)
        if not callable(attr):
            return attr

        def wrapped(*args, **kwargs):
            bucket = kwargs.get("Bucket")
            if bucket is None:
                bucket_arg_index = self._bucket_arg_index(name)
                if bucket_arg_index is not None and bucket_arg_index < len(args):
                    bucket = args[bucket_arg_index]
            client = self._client_for_bucket(bucket)
            return getattr(client, name)(*args, **kwargs)

        return wrapped
