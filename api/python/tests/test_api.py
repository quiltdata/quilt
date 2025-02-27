import pytest
import responses
import yaml

import quilt3 as he
from quilt3 import util

from .utils import QuiltTestCase

DEFAULT_URL = 'https://registry.example.com'


class TestAPI(QuiltTestCase):
    def test_config(self):
        content = {
            'navigator_url': 'https://foo.bar',
            'telemetry_disabled': False,
            's3Proxy': None,
            'apiGatewayEndpoint': None,
            'binaryApiGatewayEndpoint': None,
            "region": "us-west-2",
        }
        self.requests_mock.add(responses.GET, 'https://foo.bar/config.json', json=content, status=200)

        he.config('https://foo.bar')

        with open(util.CONFIG_PATH, 'r', encoding='utf-8') as stream:
            config = yaml.safe_load(stream)

        # These come from CONFIG_TEMPLATE, not the mocked config file.
        content['default_local_registry'] = util.BASE_PATH.as_uri() + '/packages'
        content['default_remote_registry'] = None
        content['default_install_location'] = None
        content['default_registry_version'] = 1
        content['registryUrl'] = None

        assert config == content

    def test_config_invalid_host(self):
        # Our URL handling is very forgiving, since we might receive a host
        # defined in local DNS, like 'foo' instead of 'foo.com' -- and on top
        # of that, we automatically add 'https://' to the name if no schema is
        # present.  ..but, a bad port causes an error..
        with pytest.raises(util.QuiltException, match='Port must be a number'):
            he.config('https://fliff:fluff')
