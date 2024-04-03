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
        assert (getattr(S3ClientProvider(), client).meta.config.signature_version == botocore.UNSIGNED) is is_unsigned
