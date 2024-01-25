import typing as T

import pydantic

from .types import NonEmptyStr

if T.TYPE_CHECKING:
    import boto3


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
        assert credentials
        return cls(
            key=NonEmptyStr(credentials.access_key),
            secret=NonEmptyStr(credentials.secret_key),
            token=NonEmptyStr(credentials.token),
        )
