"""Tests for quilt3.api_keys (user API key management)."""

import contextlib
import datetime
from unittest import mock

import pytest

import quilt3
from quilt3 import _graphql_client, api_keys

API_KEY = {
    "id": "key-123",
    "name": "my-key",
    "fingerprint": "qk_abc...xyz",
    "createdAt": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "expiresAt": datetime.datetime(2024, 9, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "lastUsedAt": None,
    "createdByEmail": None,
    "status": "ACTIVE",
}

MUTATION_ERRORS = (
    (
        {
            "__typename": "InvalidInput",
            "errors": [{"path": "name", "message": "error", "name": "error", "context": {}}],
        },
        api_keys.APIKeyError,
    ),
    (
        {"__typename": "OperationError", "message": "error", "name": "error", "context": {}},
        api_keys.APIKeyError,
    ),
)


def _camel_to_snake(name: str) -> str:
    return "".join("_" + c.lower() if c.isupper() else c for c in name).lstrip("_")


def _as_dataclass_kwargs(data: dict) -> dict:
    return {
        _camel_to_snake(k): (
            _as_dataclass_kwargs(v)
            if isinstance(v, dict)
            else [_as_dataclass_kwargs(x) if isinstance(x, dict) else x for x in v]
            if isinstance(v, list)
            else v
        )
        for k, v in data.items()
    }


@contextlib.contextmanager
def mock_client(data, operation_name, variables=None):
    with mock.patch("quilt3.session.get_registry_url", return_value="https://registry.example.com"):
        with mock.patch("quilt3._graphql_client.Client.execute", return_value=mock.sentinel.RESPONSE) as execute_mock:
            with mock.patch("quilt3._graphql_client.Client.get_data", return_value=data) as get_data_mock:
                yield

    execute_mock.assert_called_once_with(query=mock.ANY, operation_name=operation_name, variables=variables or {})
    get_data_mock.assert_called_once_with(mock.sentinel.RESPONSE)


def test_api_keys_list():
    with mock_client(
        {"me": {"apiKeys": [API_KEY]}},
        "apiKeysList",
        variables={"name": None, "fingerprint": None, "status": None},
    ):
        result = quilt3.api_keys.list()
        assert len(result) == 1
        assert result[0] == api_keys.APIKey(**_as_dataclass_kwargs(API_KEY))


def test_api_keys_list_with_filters():
    with mock_client(
        {"me": {"apiKeys": [API_KEY]}},
        "apiKeysList",
        variables={"name": "my-key", "fingerprint": None, "status": _graphql_client.APIKeyStatus.ACTIVE},
    ):
        result = quilt3.api_keys.list(name="my-key", status="ACTIVE")
        assert len(result) == 1


def test_api_keys_get_found():
    with mock_client(
        {"me": {"apiKey": API_KEY}},
        "apiKeyGet",
        variables={"id": "key-123"},
    ):
        result = quilt3.api_keys.get("key-123")
        assert result == api_keys.APIKey(**_as_dataclass_kwargs(API_KEY))


def test_api_keys_get_not_found():
    with mock_client(
        {"me": {"apiKey": None}},
        "apiKeyGet",
        variables={"id": "key-123"},
    ):
        assert quilt3.api_keys.get("key-123") is None


def test_api_keys_create_success():
    with mock_client(
        {
            "api_key_create": {
                "__typename": "APIKeyCreated",
                "apiKey": API_KEY,
                "secret": "qk_secret_token",
            }
        },
        "apiKeyCreate",
        variables={"input": _graphql_client.APIKeyCreateInput(name="my-key", expires_in_days=90)},
    ):
        result = quilt3.api_keys.create("my-key", expires_in_days=90)
        assert result.secret == "qk_secret_token"
        assert result.api_key == api_keys.APIKey(**_as_dataclass_kwargs(API_KEY))


@pytest.mark.parametrize("data,error_type", MUTATION_ERRORS)
def test_api_keys_create_errors(data, error_type):
    with mock_client(
        {"api_key_create": data},
        "apiKeyCreate",
        variables={"input": _graphql_client.APIKeyCreateInput(name="my-key", expires_in_days=90)},
    ):
        with pytest.raises(error_type):
            quilt3.api_keys.create("my-key", expires_in_days=90)


def test_api_keys_revoke_by_id_success():
    with mock_client(
        {"api_key_revoke": {"__typename": "Ok"}},
        "apiKeyRevoke",
        variables={"id": "key-123", "secret": None},
    ):
        assert quilt3.api_keys.revoke(id="key-123") is None


def test_api_keys_revoke_by_secret_success():
    with mock_client(
        {"api_key_revoke": {"__typename": "Ok"}},
        "apiKeyRevoke",
        variables={"id": None, "secret": "qk_secret_token"},
    ):
        assert quilt3.api_keys.revoke(secret="qk_secret_token") is None


@pytest.mark.parametrize("data,error_type", MUTATION_ERRORS)
def test_api_keys_revoke_errors(data, error_type):
    with mock_client(
        {"api_key_revoke": data},
        "apiKeyRevoke",
        variables={"id": "key-123", "secret": None},
    ):
        with pytest.raises(error_type):
            quilt3.api_keys.revoke(id="key-123")


def test_api_keys_revoke_requires_id_or_secret():
    with pytest.raises(ValueError, match="Must provide either id or secret"):
        quilt3.api_keys.revoke()
