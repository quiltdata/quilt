import re
import typing as T

from .. import _graphql_client
from .._graphql_client import exceptions as _gql_exceptions
from . import exceptions, types

# Standard graphql-core validation wording for a query referencing a field, argument, or type
# the registry's schema doesn't have -- the signature of talking to a registry too old for this
# quilt3 version's admin API. graphql-core carries no structured error code for this, so matching
# on its English wording is a stopgap tied to its exact phrasing across versions.
_SCHEMA_MISMATCH_RE = re.compile(r"Cannot query field |Unknown argument |Unknown type ")


def handle_errors(result: _graphql_client.BaseModel) -> _graphql_client.BaseModel:
    if isinstance(result, (_graphql_client.InvalidInputSelection, _graphql_client.OperationErrorSelection)):
        raise exceptions.Quilt3AdminError(result)
    return result


def handle_user_mutation(result: _graphql_client.BaseModel) -> types.User:
    return types.User.from_gql(handle_errors(result))


def raise_invalid_input(error: _graphql_client.InvalidInputSelection) -> T.NoReturn:
    first_error = error.errors[0] if error.errors else None
    if first_error is None:
        raise exceptions.InvalidInputError(error)
    if first_error.name == "PolicyDoesNotExist":
        raise exceptions.PolicyNotFoundError()
    if first_error.name == "PolicyTitleConflict":
        raise exceptions.PolicyTitleExistsError(error)
    if first_error.name == "PolicyArnConflict":
        raise exceptions.PolicyArnExistsError(error)
    if first_error.name == "RoleHasTooManyPoliciesToAttach":
        raise exceptions.RoleTooManyPoliciesError(error)
    raise exceptions.InvalidInputError(error)


def raise_operation_error(error: _graphql_client.OperationErrorSelection) -> T.NoReturn:
    raise exceptions.OperationError(error)


class _AdminClient(_graphql_client.Client):
    """GraphQL client for the admin API that gives a clean error against a registry too old to
    support the admin schema this quilt3 version expects, instead of a raw GraphQLClientGraphQLMultiError."""

    def get_data(self, response):
        try:
            return super().get_data(response)
        except _gql_exceptions.GraphQLClientGraphQLMultiError as ex:
            if any(_SCHEMA_MISMATCH_RE.search(str(error)) for error in ex.errors):
                raise exceptions.RegistryTooOldError(ex) from ex
            raise


def get_client():
    return _AdminClient()
