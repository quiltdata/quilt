"""Provides admin-only functions for Quilt."""
import typing as T

from .session import get_registry_url, get_session


def create_user(*, username: str, email: str):
    """
    Create a new user in your registry.

    Required parameters:
        username (str): Username of user to create.
        email (str): Email of user to create.
    """
    session = get_session()
    response = session.post(
        get_registry_url() + "/api/users/create",
        json={
            "username": username,
            "email": email,
        },
    )


def delete_user(*, username: str):
    """
    Delete user from your registry.

    Required parameters:
        username (str): Username of user to delete.
    """
    session = get_session()
    response = session.post(
        get_registry_url() + "/api/users/delete",
        json={
            "username": username,
        },
    )


def set_role(*, username: str, role_name: T.Optional[str]):
    """
    Set which role is associated with a user.

    Required parameters:
        username (str): Username of user to update.
        role_name (str): Role name to set for the user. Use `None` to unset role.
    """
    session = get_session()
    session.post(
        get_registry_url() + "/api/users/set_role",
        json={
            "username": username,
            "role": role_name or "",
        },
    )
