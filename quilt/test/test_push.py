"""
Tests for the push command.
"""

import json
import os

import requests
import responses

from quilt.tools import command, store
from quilt.tools.const import NodeType

from .utils import QuiltTestCase

TYPE_KEY='type'
CHILDREN_KEY='children'

def find_object_hashes(contents):
    """
    Iterator that returns hashes of all of the tables.
    """
    for key, obj in contents[CHILDREN_KEY].items():
        print("KEY=%s, OBJ=%s" % (key, obj))
        if key == TYPE_KEY:
            continue
        obj_type = NodeType(obj[TYPE_KEY])
        if obj_type is NodeType.TABLE or obj_type is NodeType.FILE:
            yield from obj["hashes"]
        elif obj_type is NodeType.GROUP:
            yield from find_object_hashes(obj)

def upload_urls(contents):
    all_hashes = set(find_object_hashes(contents))

    upload_urls = {}
    for blob_hash in all_hashes:
        template = "https://example.com/{owner}/{pkg}/{hash}"
        upload_urls[blob_hash] = template.format(owner='foo',
                                                 pkg='bar',
                                                 hash=blob_hash)
    return upload_urls


class PushTest(QuiltTestCase):
    """
    Unit tests for quilt push.
    """
    def test_push(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        pkg_obj = store.get_store('foo', 'bar')
        assert pkg_obj.exists(), "Failed build?"
        pkg_hash = pkg_obj.get_hash()
        contents = pkg_obj.get_contents()
        urls = upload_urls(contents)
        for blob_hash, url in urls.items():
            self._mock_s3(blob_hash, url)

        self._mock_put_package('foo/bar', pkg_hash, contents)
        self._mock_put_tag('foo/bar', 'latest', pkg_hash)

        session = requests.Session()
        command.push(session, 'foo/bar')

    def _mock_put_package(self, package, pkg_hash, contents):
        pkg_url = '%s/api/package/%s/%s' % (command.QUILT_PKG_URL, package, pkg_hash)
        self.requests_mock.add(responses.PUT, pkg_url, json.dumps(dict(
            # TODO: Add upload URLs here to test zip and upload code
            upload_urls=upload_urls(contents)
        )))

    def _mock_put_tag(self, package, tag, pkg_hash):
        tag_url = '%s/api/tag/%s/%s' % (command.QUILT_PKG_URL, package, tag)
        self.requests_mock.add(responses.PUT, tag_url, json.dumps(dict()))

    def _mock_s3(self, object_hash, s3_url):
        self.requests_mock.add(responses.PUT, s3_url)
