"""API for managing your own API keys."""

import typing as T
from datetime import datetime

import pydantic

from . import _graphql_client

APIKeyStatus = T.Literal["ACTIVE", "EXPIRED"]


@pydantic.dataclasses.dataclass
class APIKey:
    """An API key for programmatic access."""

    id: str
    name: str
    fingerprint: str
    created_at: datetime
    expires_at: datetime
    last_used_at: T.Optional[datetime]
    created_by_email: T.Optional[str]
    status: str


class APIKeyError(Exception):
    """Error during API key operation."""

    def __init__(self, result):
        self.result = result
        if hasattr(result, "message"):
            super().__init__(result.message)
        elif hasattr(result, "errors"):
            super().__init__(str(result.errors))
        else:
            super().__init__(str(result))


def _handle_errors(result):
    """Raise APIKeyError if result is an error type."""
    if isinstance(result, (_graphql_client.InvalidInputSelection, _graphql_client.OperationErrorSelection)):
        raise APIKeyError(result)
    return result


def list(
    name: T.Optional[str] = None,
    fingerprint: T.Optional[str] = None,
    status: T.Optional[APIKeyStatus] = None,
) -> T.List[APIKey]:
    """
    List your API keys. Optionally filter by name, fingerprint, or status.

    Args:
        name: Filter by key name.
        fingerprint: Filter by key fingerprint.
        status: Filter by "ACTIVE" or "EXPIRED". None returns all.

    Returns:
        List of your API keys matching the filters.
    """
    result = _graphql_client.Client().api_keys_list(
        name=name,
        fingerprint=fingerprint,
        status=_graphql_client.APIKeyStatus(status) if status else None,
    )
    if result is None:
        return []
    return [APIKey(**k.model_dump()) for k in result.api_keys]


def get(id: str) -> T.Optional[APIKey]:
    """
    Get a specific API key by ID.

    Args:
        id: The API key ID.

    Returns:
        The API key, or None if not found.
    """
    result = _graphql_client.Client().api_key_get(id=id)
    if result is None or result.api_key is None:
        return None
    return APIKey(**result.api_key.model_dump())


def create(
    name: str,
    expires_in_days: int = 90,
) -> T.Tuple[APIKey, str]:
    """
    Create a new API key for yourself.

    Args:
        name: Name for the API key.
        expires_in_days: Days until expiration (30-365, default 90).

    Returns:
        Tuple of (APIKey, secret). The secret is only returned once - save it securely!

    Raises:
        APIKeyError: If the operation fails.
    """
    result = _graphql_client.Client().api_key_create(
        input=_graphql_client.APIKeyCreateInput(name=name, expires_in_days=expires_in_days),
    )
    result = _handle_errors(result)
    return APIKey(**result.api_key.model_dump()), result.secret


def revoke(id: T.Optional[str] = None, secret: T.Optional[str] = None) -> None:
    """
    Revoke an API key. Provide either the key ID or the secret.

    Args:
        id: The API key ID to revoke.
        secret: The API key secret to revoke.

    Raises:
        ValueError: If neither id nor secret is provided.
        APIKeyError: If the operation fails.
    """
    if id is None and secret is None:
        raise ValueError("Must provide either id or secret")

    result = _graphql_client.Client().api_key_revoke(id=id, secret=secret)
    _handle_errors(result)
