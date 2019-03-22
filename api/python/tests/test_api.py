from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

import numpy as np
import pathlib
import pytest
import responses
from ruamel.yaml import YAML

import quilt3 as he
from quilt3 import util

from .utils import QuiltTestCase


DEFAULT_URL = 'https://quilt-t4-staging-registry.quiltdata.com'

class TestAPI(QuiltTestCase):
    def test_config(self):
        content = {
            'navigator_url': 'https://foo.bar',
            'elastic_search_url': 'https://es.foo',
            'accept_invalid_config_keys': 'yup',
        }
        self.requests_mock.add(responses.GET, 'https://foo.bar/config.json', json=content, status=200)

        mock_config = pathlib.Path('config.yml')

        with patch('quilt3.api.CONFIG_PATH', mock_config):
            he.config('foo.bar')

        # TODO: This seems unnecessary?
        assert len(self.requests_mock.calls) == 1
        assert self.requests_mock.calls[0].request.url == 'https://foo.bar/config.json'

        yaml = YAML()
        config = yaml.load(mock_config)

        content['default_local_registry'] = util.BASE_PATH.as_uri()
        content['default_remote_registry'] = None
        content['default_install_location'] = None
        content['registryUrl'] = DEFAULT_URL

        assert config == content

    def test_config_invalid_host(self):
        # Our URL handling is very forgiving, since we might receive a host
        # defined in local DNS, like 'foo' instead of 'foo.com' -- and on top
        # of that, we automatically add 'https://' to the name if no schema is
        # present.  ..but, a bad port causes an error..
        with pytest.raises(util.QuiltException, match='Port must be a number'):
            he.config('https://fliff:fluff')

    def test_put_to_directory_failure(self):
        # Adding pathes with trailing delimeters causes AWS to treat them like virtual directories
        # and can cause issues when downloading to host machine.
        test_object = "foo"
        with pytest.raises(ValueError):
            he.put(test_object, "s3://test/")

    def test_put_copy_get(self):
        data = np.array([1, 2, 3])
        meta = {'foo': 'bar', 'x': 42}

        he.put(data, 'file.json', meta)
        he.copy('file.json', 'file2.json')
        data2, meta2 = he.get('file2.json')

        assert np.array_equal(data, data2)
        assert meta == meta2

    def test_empty_list_role(self):
        empty_list_response = { 'results': [] }
        self.requests_mock.add(responses.GET, DEFAULT_URL + '/api/roles',
                json=empty_list_response, status=200)
        assert he.admin.list_roles() == []

    def test_list_role(self):
        result = {
            'name': 'test',
            'arn': 'asdf123',
            'id': '1234-1234'
        }
        list_response = { 'results': [result] }
        self.requests_mock.add(responses.GET, DEFAULT_URL + '/api/roles',
                json=list_response, status=200)
        assert he.admin.list_roles() == [result]

    def test_get_role(self):
        result = {
            'name': 'test',
            'arn': 'asdf123',
            'id': '1234-1234'
        }
        self.requests_mock.add(responses.GET, DEFAULT_URL + '/api/roles/1234-1234',
                json=result, status=200)
        assert he.admin.get_role('1234-1234') == result

    def test_create_role(self):
        result = {
            'name': 'test',
            'arn': 'asdf123',
            'id': '1234-1234'
        }
        self.requests_mock.add(responses.POST, DEFAULT_URL + '/api/roles',
                json=result, status=200)
        assert he.admin.create_role('test', 'asdf123') == result

    def test_edit_role(self):
        get_result = {
            'name': 'test',
            'arn': 'asdf123',
            'id': '1234-1234'
        }
        result = {
            'name': 'test_new_name',
            'arn': 'qwer456',
            'id': '1234-1234'
        }
        self.requests_mock.add(responses.GET, DEFAULT_URL + '/api/roles/1234-1234',
                json=get_result, status=200)
        self.requests_mock.add(responses.PUT, DEFAULT_URL + '/api/roles/1234-1234',
                json=result, status=200)
        assert he.admin.edit_role('1234-1234', 'test_new_name', 'qwer456') == result

    def test_delete_role(self):
        self.requests_mock.add(responses.DELETE, DEFAULT_URL + '/api/roles/1234-1234',
                status=200)
        he.admin.delete_role('1234-1234')

    def test_set_role(self):
        self.requests_mock.add(responses.POST, DEFAULT_URL + '/api/users/set_role',
                json={}, status=200)

        not_found_result = {
            'message': "No user exists by the provided name."
        }
        self.requests_mock.add(responses.POST, DEFAULT_URL + '/api/users/set_role',
                json=not_found_result, status=400)

        he.admin.set_role('test_user', 'test_role')

        with pytest.raises(util.QuiltException):
            he.admin.set_role('not_found', 'test_role')
