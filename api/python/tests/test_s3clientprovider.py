import os
from unittest import mock

import botocore
import pytest
from botocore.exceptions import ClientError

from quilt3.data_transfer import S3Api, S3ClientProvider

PATCH_UNSET_CREDENTIALS = mock.patch.dict(os.environ, {"AWS_SHARED_CREDENTIALS_FILE": "/not-exist"}, clear=True)
PATCH_SET_CREDENTIALS = mock.patch.dict(
    os.environ,
    dict.fromkeys(
        (
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
        ),
        "blah",
    ),
    clear=True,
)

BUCKET = 'example'
KEY = 'foo.csv'
VERSION_ID = 'v1'


def access_denied_error():
    return ClientError({'Error': {'Code': '403', 'Message': 'Forbidden'}}, 'HeadObject')


def make_provider(*, standard_client, unsigned_client):
    provider = S3ClientProvider()
    provider._standard_client = standard_client
    provider._unsigned_client = unsigned_client
    return provider


def client_denying_versioned_reads():
    """A client that may read the unversioned object, but lacks s3:GetObjectVersion."""

    def head_object(**kwargs):
        if 'VersionId' in kwargs:
            raise access_denied_error()
        return {}

    return mock.MagicMock(head_object=mock.MagicMock(side_effect=head_object))


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


def test_find_correct_client_probes_versioned_object():
    standard_client = client_denying_versioned_reads()
    unsigned_client = mock.MagicMock()
    provider = make_provider(standard_client=standard_client, unsigned_client=unsigned_client)

    params = dict(Bucket=BUCKET, Key=KEY, VersionId=VERSION_ID)

    assert provider.find_correct_client(S3Api.GET_OBJECT, BUCKET, params) is unsigned_client
    standard_client.head_object.assert_called_once_with(Bucket=BUCKET, Key=KEY, VersionId=VERSION_ID)
    unsigned_client.head_object.assert_called_once_with(Bucket=BUCKET, Key=KEY, VersionId=VERSION_ID)


def test_find_correct_client_unversioned_uses_standard_client():
    standard_client = client_denying_versioned_reads()
    unsigned_client = mock.MagicMock()
    provider = make_provider(standard_client=standard_client, unsigned_client=unsigned_client)

    params = dict(Bucket=BUCKET, Key=KEY)

    assert provider.find_correct_client(S3Api.GET_OBJECT, BUCKET, params) is standard_client
    standard_client.head_object.assert_called_once_with(Bucket=BUCKET, Key=KEY)
    unsigned_client.head_object.assert_not_called()


def test_find_correct_client_cache_distinguishes_versioned_requests():
    standard_client = client_denying_versioned_reads()
    unsigned_client = mock.MagicMock()
    provider = make_provider(standard_client=standard_client, unsigned_client=unsigned_client)

    unversioned_params = dict(Bucket=BUCKET, Key=KEY)
    versioned_params = dict(Bucket=BUCKET, Key=KEY, VersionId=VERSION_ID)

    assert provider.find_correct_client(S3Api.GET_OBJECT, BUCKET, unversioned_params) is standard_client
    assert provider.find_correct_client(S3Api.GET_OBJECT, BUCKET, versioned_params) is unsigned_client
    # Both answers stay cached independently.
    assert provider.find_correct_client(S3Api.GET_OBJECT, BUCKET, unversioned_params) is standard_client
    assert provider.find_correct_client(S3Api.GET_OBJECT, BUCKET, versioned_params) is unsigned_client
