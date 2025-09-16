"""Utility functions for Quilt admin operations."""

from .. import _graphql_client
from . import exceptions, types


def handle_errors(result: _graphql_client.BaseModel) -> _graphql_client.BaseModel:
    """Handle GraphQL errors in admin responses."""
    if isinstance(
        result, (_graphql_client.InvalidInputSelection, _graphql_client.OperationErrorSelection)
    ):
        raise exceptions.Quilt3AdminError(result)
    return result


def handle_user_mutation(result: _graphql_client.BaseModel) -> types.User:
    """Handle user mutation results and convert to User type."""
    return types.User(**handle_errors(result).model_dump())


def get_client():
    """Get GraphQL client instance."""
    return _graphql_client.Client()
