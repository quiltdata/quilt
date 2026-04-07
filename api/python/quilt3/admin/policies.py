import typing as T

from .. import _graphql_client
from . import types, util


def get(id: str) -> T.Optional[types.Policy]:
    """
    Get a specific policy from the registry. Return `None` if the policy does not exist.

    Args:
        id: Policy ID to get.
    """
    result = util.get_client().policy_get(id=id)
    if result is None:
        return None
    return util.parse_policy_result(result)


def list() -> T.List[types.Policy]:
    """
    Get a list of all policies in the registry.
    """
    return [util.parse_policy_result(policy) for policy in util.get_client().policies_list()]


def create_managed(title: str, permissions: T.List[types.Permission], roles: T.List[str]) -> types.Policy:
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


def create_unmanaged(title: str, arn: str, roles: T.List[str]) -> types.Policy:
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


def update_managed(id: str, title: str, permissions: T.List[types.Permission], roles: T.List[str]) -> types.Policy:
    """
    Update a managed policy in the registry.

    Args:
        id: Policy ID.
        title: Policy title.
        permissions: Bucket permissions to include.
        roles: Role IDs to attach to the policy.
    """
    result = util.get_client().policy_update_managed(
        id=id,
        input=_graphql_client.ManagedPolicyInput(
            title=title,
            permissions=[_permission_to_input(permission) for permission in permissions],
            roles=roles,
        ),
    )
    return _handle_policy_result(result)


def update_unmanaged(id: str, title: str, arn: str, roles: T.List[str]) -> types.Policy:
    """
    Update an unmanaged policy in the registry.

    Args:
        id: Policy ID.
        title: Policy title.
        arn: Existing IAM policy ARN.
        roles: Role IDs to attach to the policy.
    """
    result = util.get_client().policy_update_unmanaged(
        id=id,
        input=_graphql_client.UnmanagedPolicyInput(title=title, arn=arn, roles=roles),
    )
    return _handle_policy_result(result)


def delete(id: str) -> None:
    """
    Delete a policy from the registry.

    Args:
        id: Policy ID.
    """
    result = util.get_client().policy_delete(id=id)
    typename = result.typename__
    if typename == "Ok":
        return None
    if typename == "InvalidInput":
        util.raise_invalid_input(result)
    if typename == "OperationError":
        util.raise_operation_error(result)
    raise AssertionError(f"Unexpected result: {typename}")


def _permission_to_input(permission: types.Permission) -> _graphql_client.PermissionInput:
    return _graphql_client.PermissionInput(bucket=permission.bucket, level=permission.level)


def _handle_policy_result(result) -> types.Policy:
    typename = result.typename__
    if typename == "Policy":
        return util.parse_policy_result(result)
    if typename == "InvalidInput":
        util.raise_invalid_input(result)
    if typename == "OperationError":
        util.raise_operation_error(result)
    raise AssertionError(f"Unexpected result: {typename}")
