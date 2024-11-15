from __future__ import annotations

import typing as T

import pydantic

from .types import NonEmptyStr

if T.TYPE_CHECKING:
    import boto3
    from mypy_boto3_sts.type_defs import CredentialsTypeDef


class AWSCredentials(pydantic.BaseModel, frozen=True):
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
        if credentials is None:
            raise ValueError("No credentials found in provided boto3 session")

        return cls(
            key=NonEmptyStr(credentials.access_key),
            secret=NonEmptyStr(credentials.secret_key),
            token=NonEmptyStr(credentials.token),
        )

    @classmethod
    def from_sts_response(cls, response: CredentialsTypeDef):
        return cls(
            key=NonEmptyStr(response["AccessKeyId"]),
            secret=NonEmptyStr(response["SecretAccessKey"]),
            token=NonEmptyStr(response["SessionToken"]),
        )
