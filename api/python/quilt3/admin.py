"""APIs for Quilt administrators. 'Registry' refers to Quilt stack backend services, including identity management."""
import typing as T

from .session import get_registry_url, get_session


def create_user(*, username: str, email: str):
    """
    Create a new user in the registry.

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
    Delete user from the registry.

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
    Set the named Quilt role for a user.

    Required parameters:
        username (str): Username of user to update.
        role_name (str): Quilt role name assign to the user. Set a `None` value to unassign the role.
    """
    session = get_session()
    session.post(
        get_registry_url() + "/api/users/set_role",
        json={
            "username": username,
            "role": role_name or "",
        },
    )
