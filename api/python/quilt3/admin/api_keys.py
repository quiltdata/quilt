"""Admin API for managing API keys."""

from typing import List, Optional

from .. import _graphql_client
from . import exceptions, types, util


def list(
    email: Optional[str] = None,
    name: Optional[str] = None,
    fingerprint: Optional[str] = None,
    status: Optional[str] = None,
) -> List[types.APIKey]:
    """
    List API keys. Optionally filter by user email, name, fingerprint, or status.

    Args:
        email: Filter by user email.
        name: Filter by key name.
        fingerprint: Filter by key fingerprint.
        status: Filter by status ("ACTIVE" or "EXPIRED"). None returns all.

    Returns:
        List of API keys matching the filters.
    """
    result = util.get_client().admin_api_keys_list(
        email=email,
        name=name,
        fingerprint=fingerprint,
        status=_graphql_client.APIKeyStatus(status) if status else None,
    )
    return [types.APIKey(**k.model_dump()) for k in result]


def get(id: str) -> Optional[types.APIKey]:
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
    return types.APIKey(**result.model_dump())


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


def create_for_user(
    email: str,
    name: str,
    expires_in_days: int = 90,
) -> types.APIKeyCreated:
    """
    Create an API key for a user.

    Args:
        email: Email of the user to create the key for.
        name: Name for the API key.
        expires_in_days: Days until expiration (30-365, default 90).

    Returns:
        APIKeyCreated containing the API key and secret.
        The secret is only returned once at creation.

    Raises:
        Quilt3AdminError: If the operation fails (e.g., user not found).
    """
    result = util.get_client().admin_api_key_create_for_user(
        email=email,
        input=_graphql_client.APIKeyCreateInput(name=name, expires_in_days=expires_in_days),
    )
    result = util.handle_errors(result)
    return types.APIKeyCreated(
        api_key=types.APIKey(**result.api_key.model_dump()),
        secret=result.secret,
    )
