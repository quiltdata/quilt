import json
from unittest.mock import patch, MagicMock

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


def get_configured_bucket():
    with patch('quilt3.util.requests') as requests_mock:
        FEDERATION_URL = 'https://test.com/federation.json'
        mock_federation = {
                'buckets': [
                    {
                        'name': 'test-bucket',
                        'searchEndpoint': 'test'
                    }
                ]
            }
        CONFIG_URL = 'https://test.com/config.json'
        mock_config = {
                'federations': [
                    '/federation.json'
                ]
            }
        def makeResponse(text):
            mock_response = ResponseMock()
            setattr(mock_response, 'text', text)
            setattr(mock_response, 'ok', True)
            return mock_response

        def mock_get(url):
            if url == CONFIG_URL:
                return makeResponse(json.dumps(mock_config))
            elif url == FEDERATION_URL:
                return makeResponse(json.dumps(mock_federation))
            else:
                raise Exception

        requests_mock.get = mock_get
        bucket = Bucket('s3://test-bucket')
        bucket.config('https://test.com/config.json')
        return bucket

def test_bucket_config():
    bucket = get_configured_bucket()
    assert bucket._search_endpoint == 'test'

def test_bucket_search():
    with patch('quilt3.search_util._create_es') as create_es_mock:
        es_mock = MagicMock()
        es_mock.search.return_value = {
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
        create_es_mock.return_value = es_mock
        bucket = get_configured_bucket()
        results = bucket.search('*')
        assert es_mock.search.called_with('*', 'test')
        assert len(results) == 1

        query = {
            'query': {
                'term': {
                    'key': '*'
                }
            }
        }
        results = bucket.search(query)
        assert es_mock.search.called_with('*', 'test')
        assert len(results) == 1

def mock_find_bucket_config(bucket_name, catalog_config_url):
    return dict(searchEndpoint='test',
                region='us-east-1')

class SearchTestCase(QuiltTestCase):

    def test_all_bucket_search(self):
        with patch('quilt3.util.requests') as requests_mock:
            navigator_url = get_from_config('navigator_url')
            FEDERATION_URL = 'https://example.com/federation.json'
            mock_federation = {
                    'buckets': [
                        {
                            'name': 'test-bucket',
                            'searchEndpoint': 'test',
                            'region': 'test-aws-region'
                        }
                    ]
                }
            CONFIG_URL = navigator_url + '/config.json'
            mock_config = {
                    'federations': [
                        '/federation.json'
                    ]
                }
            def makeResponse(text):
                mock_response = ResponseMock()
                setattr(mock_response, 'text', text)
                setattr(mock_response, 'ok', True)
                return mock_response

            def mock_get(url):
                if url == CONFIG_URL:
                    return makeResponse(json.dumps(mock_config))
                elif url == FEDERATION_URL:
                    return makeResponse(json.dumps(mock_federation))
                else:
                    raise Exception

            requests_mock.get = mock_get

            with patch('quilt3.search_util._create_es') as create_es_mock:
                es_mock = MagicMock()
                es_mock.search.return_value = {
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
                create_es_mock.return_value = es_mock
                results = search('*')
                assert es_mock.search.called_with('*', 'test')
                assert len(results) == 1

                query = {
                    'query': {
                        'term': {
                            'key': '*'
                        }
                    }
                }
                results = search(query)
                assert es_mock.search.called_with('*', 'test')
                assert len(results) == 1
