"""Run arbitrary GraphQL operations against the Quilt registry.

This is an escape hatch for registry capabilities that the typed `quilt3` API
does not wrap yet. It reuses the same authenticated transport as the rest of
`quilt3`, so `quilt3.login()` (or `quilt3.login_with_api_key()`) is the only
setup needed.
"""

import typing as T

from . import _graphql_client
from ._graphql_client import exceptions as _exceptions

#: Base class for every error raised by `execute()`.
GraphQLError = _exceptions.GraphQLClientError
#: The registry responded with a non-2xx status. Has `status_code`, `response`.
GraphQLHttpError = _exceptions.GraphQLClientHttpError
#: The response body was not a valid GraphQL response. Has `response`.
GraphQLInvalidResponseError = _exceptions.GraphQLClientInvalidResponseError
#: The registry returned GraphQL `errors`. Has `errors`, `data`.
GraphQLOperationError = _exceptions.GraphQLClientGraphQLMultiError

__all__ = [
    "GraphQLError",
    "GraphQLHttpError",
    "GraphQLInvalidResponseError",
    "GraphQLOperationError",
    "execute",
]


def execute(
    query: str,
    variables: dict[str, T.Any] | None = None,
    operation_name: str | None = None,
) -> dict[str, T.Any]:
    """
    Execute a GraphQL query or mutation against the Quilt registry.

    Mutations are allowed: whatever your credentials are permitted to do, this
    will do. The registry enforces authorization; this function does not
    second-guess it.

    File uploads (the GraphQL multipart request spec / `Upload` scalar) are
    not supported: pass only JSON-serializable values in `variables`.

    Args:
        query: The GraphQL document to execute.
        variables: Variable values for the document.
        operation_name: Which operation to run, if the document defines more
            than one.

    Returns:
        The unwrapped `data` object from the GraphQL response.

    Raises:
        GraphQLOperationError: The registry returned GraphQL `errors`.
        GraphQLInvalidResponseError: The response body was not a valid GraphQL
            response.
        QuiltException: The request failed at the HTTP level (e.g. bad
            credentials, server error) — raised by the shared session before
            the GraphQL response is parsed.
    """
    client = _graphql_client.Client()
    response = client.execute(query=query, operation_name=operation_name, variables=variables or {})
    return client.get_data(response)
