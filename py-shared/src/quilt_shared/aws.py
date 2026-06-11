from __future__ import annotations

import typing as T

import pydantic.v1

from .types import NonEmptyStr

if T.TYPE_CHECKING:
    import boto3
    from types_boto3_sts.type_defs import CredentialsTypeDef


class BotoSessionCredentials(T.TypedDict):
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_session_token: str


class AWSCredentials(pydantic.v1.BaseModel, frozen=True):
    key: NonEmptyStr
    secret: NonEmptyStr
    token: NonEmptyStr

    @property
    def boto_args(self):
        return BotoSessionCredentials(
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
