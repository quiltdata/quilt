import os
from unittest import mock

import botocore
import pytest

from quilt3.data_transfer import S3ClientProvider

PATCH_UNSET_CREDENTIALS = mock.patch.dict(os.environ, clear=True)
PATCH_SET_CREDENTIALS = mock.patch.dict(
    os.environ,
    dict.fromkeys(
        (
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
        ),
        "blah"
    ),
    clear=True,
)


@pytest.mark.parametrize(
    "credentials_context_manager, client, is_unsigned",
    [
        (PATCH_UNSET_CREDENTIALS, "standard_client", True),
        (PATCH_UNSET_CREDENTIALS, "unsigned_client", True),
        (PATCH_SET_CREDENTIALS, "standard_client", False),
        (PATCH_SET_CREDENTIALS, "unsigned_client", True),
    ],
)
def test_client(credentials_context_manager, client, is_unsigned):
    with credentials_context_manager:
        cf = getattr(S3ClientProvider(), client).meta.config
        session = S3ClientProvider().get_boto_session()
        is_set = credentials_context_manager == PATCH_SET_CREDENTIALS
        creds = session.get_credentials()
        print(f"client: {client}")
        print(f"is_set: {is_set} creds: {creds}")
        print(f"credentials_context_manager: {credentials_context_manager}: {vars(credentials_context_manager)}")
        assert (cf.signature_version == botocore.UNSIGNED) is is_unsigned, (
            f"{client} has signature_version {cf.signature_version} "
            f"but expected {botocore.UNSIGNED} "
            f"for credentials_set: {is_set}"
        )
