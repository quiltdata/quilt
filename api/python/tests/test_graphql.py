import contextlib
import json
from unittest import mock

import pytest
import responses

import quilt3
from quilt3._graphql_client import exceptions as gql_exceptions
from quilt3.util import QuiltException

from .utils import QuiltTestCase

QUERY = "query { config { region } }"


@contextlib.contextmanager
def mock_client(data=None, exc=None):
    with mock.patch("quilt3.session.get_registry_url", return_value="https://registry.example.com"):
        with mock.patch("quilt3._graphql_client.Client.execute", return_value=mock.sentinel.RESPONSE) as execute_mock:
            with mock.patch(
                "quilt3._graphql_client.Client.get_data",
                **({"side_effect": exc} if exc is not None else {"return_value": data}),
            ) as get_data_mock:
                yield execute_mock, get_data_mock


def test_execute():
    with mock_client({"config": {"region": "us-east-1"}}) as (execute_mock, get_data_mock):
        assert quilt3.graphql.execute(QUERY) == {"config": {"region": "us-east-1"}}

    execute_mock.assert_called_once_with(query=QUERY, operation_name=None, variables={})
    get_data_mock.assert_called_once_with(mock.sentinel.RESPONSE)


def test_execute_with_variables_and_operation_name():
    with mock_client({"package": None}) as (execute_mock, _):
        quilt3.graphql.execute(
            QUERY,
            variables={"name": "foo/bar"},
            operation_name="myOp",
        )

    execute_mock.assert_called_once_with(query=QUERY, operation_name="myOp", variables={"name": "foo/bar"})


def test_public_exception_aliases():
    assert quilt3.graphql.GraphQLError is gql_exceptions.GraphQLClientError
    for alias in (
        quilt3.graphql.GraphQLHttpError,
        quilt3.graphql.GraphQLInvalidResponseError,
        quilt3.graphql.GraphQLOperationError,
    ):
        assert issubclass(alias, quilt3.graphql.GraphQLError)


class GraphQLTransportTest(QuiltTestCase):
    """End-to-end through the real session and BaseClient against a mocked endpoint."""

    GRAPHQL_URL = "https://registry.example.com/graphql"

    def setUp(self):
        super().setUp()
        quilt3.session.clear_session()
        self.addCleanup(quilt3.session.clear_session)

    def _mock_graphql_response(self, body, status=200, **kwargs):
        self.requests_mock.add(responses.POST, self.GRAPHQL_URL, json=body, status=status, **kwargs)

    def _last_request_body(self):
        return json.loads(self.requests_mock.calls[-1].request.body)

    def test_success(self):
        self._mock_graphql_response({"data": {"config": {"region": "us-east-1"}}})

        result = quilt3.graphql.execute(QUERY, variables={"name": "foo/bar"}, operation_name="myOp")

        assert result == {"config": {"region": "us-east-1"}}
        assert self._last_request_body() == {
            "query": QUERY,
            "operationName": "myOp",
            "variables": {"name": "foo/bar"},
        }

    def test_graphql_errors(self):
        self._mock_graphql_response(
            {
                "data": None,
                "errors": [
                    {"message": "Cannot query field 'nope'", "locations": [{"line": 1, "column": 9}]},
                    {"message": "Unauthorized"},
                ],
            }
        )

        with pytest.raises(quilt3.graphql.GraphQLOperationError) as excinfo:
            quilt3.graphql.execute(QUERY)

        assert [e.message for e in excinfo.value.errors] == ["Cannot query field 'nope'", "Unauthorized"]
        assert str(excinfo.value) == "Cannot query field 'nope'; Unauthorized"

    def test_graphql_errors_with_partial_data(self):
        self._mock_graphql_response(
            {
                "data": {"config": None},
                "errors": [{"message": "boom", "path": ["config"]}],
            }
        )

        with pytest.raises(quilt3.graphql.GraphQLOperationError) as excinfo:
            quilt3.graphql.execute(QUERY)

        assert excinfo.value.data == {"config": None}

    def test_http_error(self):
        # The shared session's response hook turns non-2xx into QuiltException
        # before get_data() ever sees the response.
        self._mock_graphql_response({"message": "Internal Server Error"}, status=500)

        with pytest.raises(QuiltException, match="Internal Server Error"):
            quilt3.graphql.execute(QUERY)

    def test_auth_error(self):
        self._mock_graphql_response({"message": "nope"}, status=401)

        with pytest.raises(QuiltException, match="Authentication failed"):
            quilt3.graphql.execute(QUERY)

    def test_invalid_response_not_json(self):
        self.requests_mock.add(responses.POST, self.GRAPHQL_URL, body="<html>gateway error</html>", status=200)

        with pytest.raises(quilt3.graphql.GraphQLInvalidResponseError):
            quilt3.graphql.execute(QUERY)

    def test_invalid_response_no_data_or_errors(self):
        self._mock_graphql_response({"unexpected": "shape"})

        with pytest.raises(quilt3.graphql.GraphQLInvalidResponseError):
            quilt3.graphql.execute(QUERY)
