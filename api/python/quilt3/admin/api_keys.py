"""Admin API for managing API keys."""

from typing import List, Optional, Tuple, Union

from .. import _graphql_client
from ..api_keys import APIKey, Status
from . import util


def list(
    email: Optional[str] = None,
    key_name: Optional[str] = None,
    fingerprint: Optional[str] = None,
    status: Optional[Union[Status, str]] = None,
) -> List[APIKey]:
    """
    List API keys. Optionally filter by user email, key name, fingerprint, or status.

    Args:
        email: Filter by user email.
        key_name: Filter by key name.
        fingerprint: Filter by key fingerprint.
        status: Filter by Status.ACTIVE or Status.EXPIRED. None returns all.

    Returns:
        List of API keys matching the filters.
    """
    result = util.get_client().admin_api_keys_list(
        email=email,
        name=key_name,
        fingerprint=fingerprint,
        status=Status(status) if status else None,
    )
    return [APIKey(**k.model_dump()) for k in result]


def get(id: str) -> Optional[APIKey]:
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


def create_for_user(
    email: str,
    name: str,
    expires_in_days: int = 90,
) -> Tuple[APIKey, str]:
    """
    Create an API key for a user.

    Args:
        email: Email of the user to create the key for.
        name: Name for the API key.
        expires_in_days: Days until expiration (30-365, default 90).

    Returns:
        Tuple of (APIKey, secret). The secret is only returned once - save it securely!

    Raises:
        Quilt3AdminError: If the operation fails (e.g., user not found).
    """
    result = util.get_client().admin_api_key_create_for_user(
        email=email,
        input=_graphql_client.APIKeyCreateInput(name=name, expires_in_days=expires_in_days),
    )
    result = util.handle_errors(result)
    return APIKey(**result.api_key.model_dump()), result.secret
