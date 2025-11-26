from __future__ import annotations

import contextlib
import functools
import tempfile
import typing as T

import pydantic.v1

from . import const

if T.TYPE_CHECKING:
    import logging

    from types_boto3_s3.client import S3Client


class VersionId(pydantic.v1.ConstrainedStr):
    strip_whitespace = True
    min_length = 1
    max_length = 1024


class RequestTooLarge(Exception):
    size: int
    max_size: int

    def __init__(self, *, size: int, max_size: int):
        super().__init__(self.size, self.max_size)
        self.size = size
        self.max_size = max_size


@contextlib.contextmanager
def request_from_file(
    *,
    bucket: str,
    request_type: str,
    version_id: str,
    s3: S3Client,
    max_size: int,
    logger: T.Optional[logging.Logger],
):
    user_request_key = const.USER_REQUESTS_PREFIX + request_type

    try:
        size = s3.head_object(
            Bucket=bucket,
            Key=user_request_key,
            VersionId=version_id,
        )["ContentLength"]
        if size > max_size:
            raise RequestTooLarge(size=size, max_size=max_size)

        # download file with user request using lambda's role
        with tempfile.TemporaryFile() as tmp_file:
            s3.download_fileobj(
                bucket,
                user_request_key,
                tmp_file,
                ExtraArgs={"VersionId": version_id},
            )
            tmp_file.seek(0)
            yield tmp_file

    finally:
        try:
            s3.delete_object(
                Bucket=bucket,
                Key=user_request_key,
                VersionId=version_id,
            )
        except Exception:
            if logger:
                logger.exception("Error while removing user request file from S3")


FnReturn = T.TypeVar("FnReturn")


def large_request_handler(
    request_type: str,
    *,
    bucket: str,
    s3: S3Client,
    max_size: int = const.LAMBDA_TMP_SPACE,
    logger: T.Optional[logging.Logger] = None,
):
    def inner(f: T.Callable[[T.IO[bytes]], FnReturn]):
        @functools.wraps(f)
        @pydantic.v1.validate_arguments
        def wrapper(version_id: VersionId) -> FnReturn:
            with request_from_file(
                bucket=bucket,
                request_type=request_type,
                version_id=version_id,
                s3=s3,
                max_size=max_size,
                logger=logger,
            ) as req_file:
                return f(req_file)

        return wrapper

    return inner
