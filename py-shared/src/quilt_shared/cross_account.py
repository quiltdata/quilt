from __future__ import annotations

import functools
import json
import os

import boto3
import botocore.config


ROLE_MAP_ENV = "QUILT_CROSS_ACCOUNT_ROLE_MAP"


@functools.cache
def get_role_map() -> dict[str, str]:
    raw = os.getenv(ROLE_MAP_ENV, "{}")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


@functools.cache
def _assumed_bucket_client(role_arn: str, user_agent_extra: str | None):
    sts = boto3.client("sts")
    creds = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName="quilt-cross-account-indexer",
    )["Credentials"]
    return boto3.session.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
    ).client(
        "s3",
        config=botocore.config.Config(user_agent_extra=user_agent_extra) if user_agent_extra else None,
    )


class BucketRoleAwareS3Client:
    def __init__(self, *, user_agent_extra: str | None = None):
        self._user_agent_extra = user_agent_extra
        self._default_client = boto3.client(
            "s3",
            config=botocore.config.Config(user_agent_extra=user_agent_extra) if user_agent_extra else None,
        )

    @property
    def exceptions(self):
        return self._default_client.exceptions

    def _client_for_bucket(self, bucket: str | None):
        if not bucket:
            return self._default_client
        role_arn = get_role_map().get(bucket)
        if not role_arn:
            return self._default_client
        return _assumed_bucket_client(role_arn, self._user_agent_extra)

    def __getattr__(self, name):
        attr = getattr(self._default_client, name)
        if not callable(attr):
            return attr

        def wrapped(*args, **kwargs):
            client = self._client_for_bucket(kwargs.get("Bucket"))
            return getattr(client, name)(*args, **kwargs)

        return wrapped
