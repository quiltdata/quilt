import json
from unittest.mock import patch, MagicMock

import responses

from quilt3 import Bucket, search

from quilt3.search_util import get_search_schema
from quilt3.util import get_from_config

from .utils import QuiltTestCase

@patch('quilt3.search_util.get_raw_mapping_unpacked')
def test_search_schema_transform(get_raw_mapping_unpacked):
    get_raw_mapping_unpacked.return_value = {
        'properties': {
            'user_meta': {
                'properties': {
                    'foo': {
                        'type': 'text'
                    },
                    'bar': {
                        'type': 'long'
                    },
                    'baz': {
                        'properties': {
                            'asdf': {
                                'type': 'keyword'
                            }
                        }
                    }
                }
            }
        }
    }
    search_endpoint = 'https://foo.bar/search'
    region = 'us-east-1'
    result = get_search_schema(search_endpoint, region)
    expected = {
        'user_meta': {
            'foo': 'text',
            'bar': 'long',
            'baz': {
                'asdf': 'keyword'
            }
        }
    }
    assert result == expected


class ResponseMock(object):
    pass


class SearchTestCase(QuiltTestCase):

    def test_all_bucket_search(self):
        navigator_url = get_from_config('navigator_url')
        api_gateway_url = get_from_config('apiGatewayEndpoint')
        search_url = api_gateway_url + '/search'
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
