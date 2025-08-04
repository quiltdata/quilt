
from typing import List, Optional

from . import _graphql_client, exceptions, types, util


def get(name: str) -> Optional[types.User]:
    """
    Get a specific user from the registry. Return `None` if the user does not exist.

    Args:
        name: Username of user to get.
    """
    result = util.get_client().users_get(name=name)
    if result is None:
        return None
    return types.User(**result.model_dump())


def list() -> List[types.User]:
    """
    Get a list of all users in the registry.
    """
    return [types.User(**u.model_dump()) for u in util.get_client().users_list()]


def create(name: str, email: str, role: str, extra_roles: Optional[List[str]] = None) -> types.User:
    """
    Create a new user in the registry.

    Args:
        name: Username of user to create.
        email: Email of user to create.
        role: Active role of the user.
        extra_roles: Additional roles to assign to the user.
    """

    return util.handle_user_mutation(
        util.get_client().users_create(
            input=_graphql_client.UserInput(name=name, email=email, role=role, extraRoles=extra_roles)
        )
    )


def delete(name: str) -> None:
    """
    Delete user from the registry.

    Args:
        name: Username of user to delete.
    """
    result = util.get_client().users_delete(name=name)
    if result is None:
        raise exceptions.UserNotFoundError
    util.handle_errors(result.delete)


def set_email(name: str, email: str) -> types.User:
    """
    Set the email for a user.

    Args:
        name: Username of user to update.
        email: Email to set for the user.
    """
    result = util.get_client().users_set_email(name=name, email=email)
    if result is None:
        raise exceptions.UserNotFoundError
    return util.handle_user_mutation(result.set_email)


def set_admin(name: str, admin: bool) -> types.User:
    """
    Set the admin status for a user.

    Args:
        name: Username of user to update.
        admin: Admin status to set for the user.
    """
    result = util.get_client().users_set_admin(name=name, admin=admin)
    if result is None:
        raise exceptions.UserNotFoundError
    return util.handle_user_mutation(result.set_admin)


def set_active(name: str, active: bool) -> types.User:
    """
    Set the active status for a user.

    Args:
        name: Username of user to update.
        active: Active status to set for the user.
    """
    result = util.get_client().users_set_active(name=name, active=active)
    if result is None:
        raise exceptions.UserNotFoundError
    return util.handle_user_mutation(result.set_active)


def reset_password(name: str) -> None:
    """
    Reset the password for a user.

    Args:
        name: Username of user to update.
    """
    result = util.get_client().users_reset_password(name=name)
    if result is None:
        raise exceptions.UserNotFoundError
    util.handle_errors(result.reset_password)


def set_role(
    name: str,
    role: str,
    extra_roles: Optional[List[str]] = None,
    *,
    append: bool = False,
) -> types.User:
    """
    Set the active and extra roles for a user.

    Args:
        name: Username of user to update.
        role: Role to be set as the active role.
        extra_roles: Additional roles to assign to the user.
        append: If True, append the extra roles to the existing roles. If False, replace the existing roles.
    """
    result = util.get_client().users_set_role(name=name, role=role, extra_roles=extra_roles, append=append)
    if result is None:
        raise exceptions.UserNotFoundError
    return util.handle_user_mutation(result.set_role)


def add_roles(name: str, roles: List[str]) -> types.User:
    """
    Add roles to a user.

    Args:
        name: Username of user to update.
        roles: Roles to add to the user.
    """
    result = util.get_client().users_add_roles(name=name, roles=roles)
    if result is None:
        raise exceptions.UserNotFoundError
    return util.handle_user_mutation(result.add_roles)


def remove_roles(
    name: str,
    roles: List[str],
    fallback: Optional[str] = None,
) -> types.User:
    """
    Remove roles from a user.

    Args:
        name: Username of user to update.
        roles: Roles to remove from the user.
        fallback: If set, the role to assign to the user if the active role is removed.
    """
    result = util.get_client().users_remove_roles(name=name, roles=roles, fallback=fallback)
    if result is None:
        raise exceptions.UserNotFoundError
    return util.handle_user_mutation(result.remove_roles)
