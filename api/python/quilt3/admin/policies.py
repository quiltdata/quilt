import typing as T

from .. import _graphql_client
from . import exceptions, types, util


def _get_by_id(id: str) -> T.Optional[types.Policy]:
    result = util.get_client().policy_get(id=id)
    if result is None:
        return None
    return types.Policy.from_gql(result)


def _get_by_title(title: str) -> T.Optional[types.Policy]:
    return next((p for p in list() if p.title == title), None)


def get(id_or_title: str) -> T.Optional[types.Policy]:
    """
    Get a policy by ID or title. Return `None` if the policy does not exist.

    Args:
        id_or_title: Policy ID or title.
    """
    return _get_by_id(id_or_title) or _get_by_title(id_or_title)


def _resolve_policy(id_or_title: str) -> types.Policy:
    """Resolve a policy by ID or title, raising PolicyNotFoundError if not found."""
    result = get(id_or_title)
    if result is not None:
        return result
    raise exceptions.PolicyNotFoundError()


def list() -> T.List[types.Policy]:
    """
    Get a list of all policies in the registry.
    """
    return [types.Policy.from_gql(policy) for policy in util.get_client().policies_list()]


def create_managed(
    title: str, *, permissions: T.List[types.Permission], roles: T.List[str] = ()
) -> types.Policy:
    """
    Create a managed policy in the registry.

    Args:
        title: Policy title.
        permissions: Bucket permissions to include.
        roles: Role IDs to attach to the policy.
    """
    result = util.get_client().policy_create_managed(
        input=_graphql_client.ManagedPolicyInput(
            title=title,
            permissions=[_permission_to_input(permission) for permission in permissions],
            roles=roles,
        )
    )
    return _handle_policy_result(result)


def create_unmanaged(title: str, *, arn: str, roles: T.List[str] = ()) -> types.Policy:
    """
    Create an unmanaged policy in the registry.

    Args:
        title: Policy title.
        arn: Existing IAM policy ARN.
        roles: Role IDs to attach to the policy.
    """
    result = util.get_client().policy_create_unmanaged(
        input=_graphql_client.UnmanagedPolicyInput(title=title, arn=arn, roles=roles)
    )
    return _handle_policy_result(result)


def update_managed(
    id_or_title: str, *, title: str, permissions: T.List[types.Permission], roles: T.List[str]
) -> types.Policy:
    """
    Update a managed policy in the registry (full replacement).

    Args:
        id_or_title: Policy ID or title.
        title: New policy title.
        permissions: Bucket permissions to include.
        roles: Role IDs to attach to the policy.
    """
    policy = _resolve_policy(id_or_title)
    result = util.get_client().policy_update_managed(
        id=policy.id,
        input=_graphql_client.ManagedPolicyInput(
            title=title,
            permissions=[_permission_to_input(permission) for permission in permissions],
            roles=roles,
        ),
    )
    return _handle_policy_result(result)


def update_unmanaged(
    id_or_title: str, *, title: str, arn: str, roles: T.List[str]
) -> types.Policy:
    """
    Update an unmanaged policy in the registry (full replacement).

    Args:
        id_or_title: Policy ID or title.
        title: New policy title.
        arn: Existing IAM policy ARN.
        roles: Role IDs to attach to the policy.
    """
    policy = _resolve_policy(id_or_title)
    result = util.get_client().policy_update_unmanaged(
        id=policy.id,
        input=_graphql_client.UnmanagedPolicyInput(title=title, arn=arn, roles=roles),
    )
    return _handle_policy_result(result)


def patch_managed(
    id_or_title: str,
    *,
    title: T.Optional[str] = None,
    permissions: T.Optional[T.List[types.Permission]] = None,
    roles: T.Optional[T.List[str]] = None,
) -> types.Policy:
    """
    Partially update a managed policy — only specified fields are changed.

    Args:
        id_or_title: Policy ID or title.
        title: New policy title (keeps current if not specified).
        permissions: Bucket permissions (keeps current if not specified).
        roles: Role IDs to attach (keeps current if not specified).
    """
    current = _resolve_policy(id_or_title)
    return update_managed(
        current.id,
        title=title if title is not None else current.title,
        permissions=permissions if permissions is not None else current.permissions,
        roles=roles if roles is not None else [r.id for r in current.roles],
    )


def patch_unmanaged(
    id_or_title: str,
    *,
    title: T.Optional[str] = None,
    arn: T.Optional[str] = None,
    roles: T.Optional[T.List[str]] = None,
) -> types.Policy:
    """
    Partially update an unmanaged policy — only specified fields are changed.

    Args:
        id_or_title: Policy ID or title.
        title: New policy title (keeps current if not specified).
        arn: New IAM policy ARN (keeps current if not specified).
        roles: Role IDs to attach (keeps current if not specified).
    """
    current = _resolve_policy(id_or_title)
    return update_unmanaged(
        current.id,
        title=title if title is not None else current.title,
        arn=arn if arn is not None else current.arn,
        roles=roles if roles is not None else [r.id for r in current.roles],
    )


def delete(id_or_title: str) -> None:
    """
    Delete a policy from the registry.

    Args:
        id_or_title: Policy ID or title.
    """
    policy = _resolve_policy(id_or_title)
    result = util.get_client().policy_delete(id=policy.id)
    typename = result.typename__
    if typename == "Ok":
        return None
    if typename == "InvalidInput":
        util.raise_invalid_input(result)
    if typename == "OperationError":
        util.raise_operation_error(result)
    assert False, f"Unexpected policy delete result: {typename}"


def _permission_to_input(permission: types.Permission) -> _graphql_client.PermissionInput:
    return _graphql_client.PermissionInput(bucket=permission.bucket, level=permission.level)


def _handle_policy_result(result) -> types.Policy:
    typename = result.typename__
    if typename == "Policy":
        return types.Policy.from_gql(result)
    if typename == "InvalidInput":
        util.raise_invalid_input(result)
    if typename == "OperationError":
        util.raise_operation_error(result)
    assert False, f"Unexpected policy result: {typename}"
