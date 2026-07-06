import io

from botocore.stub import Stubber

import t4_lambda_pkgpush
from quilt3.util import PhysicalKey
from quilt_shared.aws import AWSCredentials
from quilt_shared.pkgpush import ChecksumAlgorithm
from quilt_shared.types import NonEmptyStr

CREDENTIALS = AWSCredentials(
    key=NonEmptyStr("test_aws_access_key_id"),
    secret=NonEmptyStr("test_aws_secret_access_key"),
    token=NonEmptyStr("test_aws_session_token"),
)


def test_invoke_copy_lambda(lambda_stub: Stubber):
    SRC_BUCKET = "src-bucket"
    SRC_KEY = "src-key"
    SRC_VERSION_ID = "src-version-id"
    DST_BUCKET = "dst-bucket"
    DST_KEY = "dst-key"
    DST_VERSION_ID = "dst-version-id"

    lambda_stub.add_response(
        "invoke",
        {"Payload": io.BytesIO(b'{"result": {"version": "%s"}}' % DST_VERSION_ID.encode())},
    )

    assert (
        t4_lambda_pkgpush.invoke_copy_lambda(
            CREDENTIALS,
            PhysicalKey(SRC_BUCKET, SRC_KEY, SRC_VERSION_ID),
            PhysicalKey(DST_BUCKET, DST_KEY, None),
            ChecksumAlgorithm.SHA256_CHUNKED,
        )
        == DST_VERSION_ID
    )
