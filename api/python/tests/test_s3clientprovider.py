import os
from unittest import mock

import botocore
import pytest

from quilt3.data_transfer import S3ClientProvider

PATCH_UNSET_CREDENTIALS = mock.patch.dict(os.environ, {"AWS_SHARED_CREDENTIALS_FILE": "/not-exist"}, clear=True)
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


def test_add_options_safely():
    # Step 1: Define the base params
    params = {"Checksum": "1234"}

    # Step 2: Define two sets of options
    safe_options = {"ServerSideEncryption": "AES256"}
    unsafe_options = {"Checksum": "5678"}

    # Step 3: Add the safe_options to the params
    S3ClientProvider.add_options_safely(params, safe_options)

    # Step 4: Verify the options were added
    assert params["ServerSideEncryption"] == "AES256"
    assert params["Checksum"] == "1234"

    # Step 5: Verify the unsafe options cause an error
    with pytest.raises(ValueError):
        S3ClientProvider.add_options_safely(params, unsafe_options)


def test_register_event_options():
    # Step 1: Register an event and options
    options = {"ServerSideEncryption": "AES256"}
    S3ClientProvider.register_event_options("provide-client-params.s3.PutObject", **options)

    # Step 2: Verify a callback is registered
    assert "provide-client-params.s3.PutObject" in S3ClientProvider._event_callbacks

    # Step 3: Verify the callback updates the params
    params = {}
    S3ClientProvider._event_callbacks["provide-client-params.s3.PutObject"](params)
    assert params["ServerSideEncryption"] == "AES256"


def test_register_event_callback():
    # Step 1: Register an event and callback
    def dummy_callback(params, **kwargs):
        params["DummyKey"] = "DummyValue"

    S3ClientProvider.register_event_callback("provide-client-params.s3.PutObject", dummy_callback)

    # Step 2: Verify the event is registered
    assert "provide-client-params.s3.PutObject" in S3ClientProvider._event_callbacks
    assert S3ClientProvider._event_callbacks["provide-client-params.s3.PutObject"] == dummy_callback


def test_callback_execution():
    # Step 1: Register a callback that modifies params
    options = {"ServerSideEncryption": "AES256"}

    def callback(params, **_kwargs):
        S3ClientProvider.add_options_safely(params, options)

    S3ClientProvider.register_event_callback("provide-client-params.s3.PutObject", callback)

    # Step 2: Simulate triggering the event and modifying params
    params = {}
    callback_func = S3ClientProvider._event_callbacks["provide-client-params.s3.PutObject"]
    callback_func(params)

    # Step 3: Verify params were modified
    assert params["ServerSideEncryption"] == "AES256"
