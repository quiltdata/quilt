"""Admin API for managing API keys."""

import typing as T

from .. import _graphql_client
from ..api_keys import APIKey, APIKeyStatus
from . import util


def list(
    email: T.Optional[str] = None,
    key_name: T.Optional[str] = None,
    fingerprint: T.Optional[str] = None,
    status: T.Optional[APIKeyStatus] = None,
) -> T.List[APIKey]:
    """
    List API keys. Optionally filter by user email, key name, fingerprint, or status.

    Args:
        email: Filter by user email.
        key_name: Filter by key name.
        fingerprint: Filter by key fingerprint.
        status: Filter by "ACTIVE" or "EXPIRED". None returns all.

    Returns:
        List of API keys matching the filters.
    """
    result = util.get_client().admin_api_keys_list(
        email=email,
        name=key_name,
        fingerprint=fingerprint,
        status=_graphql_client.APIKeyStatus(status) if status else None,
    )
    return [APIKey(**k.model_dump()) for k in result]


def get(id: str) -> T.Optional[APIKey]:
    """
    Get a specific API key by ID.

    Args:
        id: The API key ID.

    Returns:
        The API key, or None if not found.
    """
    result = util.get_client().admin_api_key_get(id=id)
    if result is None:
        return None
    return APIKey(**result.model_dump())


def revoke(id: str) -> None:
    """
    Revoke an API key.

    Args:
        id: The API key ID to revoke.

    Raises:
        Quilt3AdminError: If the operation fails.
    """
    result = util.get_client().admin_api_key_revoke(id=id)
    util.handle_errors(result)
