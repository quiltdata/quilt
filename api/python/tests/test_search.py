from unittest import mock

import responses

from quilt3 import search

from .utils import QuiltTestCase


class ResponseMock:
    pass


class SearchTestCase(QuiltTestCase):
    def test_all_bucket_search(self):
        registry_url = "https://registry.example.com"
        mock_search = {
            'hits': {
                'hits': [{
                    '_source': {
                        'key': 'asdf',
                        'version_id': 'asdf',
                        'type': 'asdf',
                        'user_meta': {},
                        'size': 0,
                        'text': '',
                        'updated': '0'
                    }
                }]
            }
        }

        for user_query, expected_query_param in (
            ("*", dict(action="search", index="_all", size=10, query="*")),
            (
                {"query": {"query_string": {"query": "handle:test*"}}},
                dict(
                    action="freeform",
                    index="_all",
                    size=10,
                    body='{"query": {"query_string": {"query": "handle:test*"}}}',
                ),
            ),
        ):
            with self.subTest(user_query=user_query, expected_query_param=expected_query_param):
                self.requests_mock.get(
                    f"{registry_url}/api/search",
                    match=[responses.matchers.query_param_matcher(expected_query_param)],
                    json=mock_search,
                    status=200,
                )
                with mock.patch("quilt3.session.get_registry_url", return_value=registry_url) as get_registry_url_mock:
                    results = search(user_query)

                get_registry_url_mock.assert_called_with()
                assert len(results) == 1
