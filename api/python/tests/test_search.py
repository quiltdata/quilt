import responses

from quilt3 import search
from quilt3.util import get_from_config

from .utils import QuiltTestCase


class ResponseMock:
    pass


class SearchTestCase(QuiltTestCase):

    def test_all_bucket_search(self):
        registryUrl = get_from_config("registryUrl")
        search_url = registryUrl + "/search"
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

        self.requests_mock.add(responses.GET,
                               f"{search_url}?index=%2A&action=search&query=%2A",
                               json=mock_search,
                               status=200,
                               match_querystring=True)
        results = search("*")
        assert len(results) == 1
