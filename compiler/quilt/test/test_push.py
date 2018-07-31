"""
Tests for the push command.
"""

import gzip
import json
import os

import responses
from six import BytesIO

from quilt.tools import command, store
from quilt.tools.core import decode_node, find_object_hashes, hash_contents

from .utils import QuiltTestCase


def _decode_body(body):
    with gzip.GzipFile(fileobj=BytesIO(body)) as fd:
        ungzipped_body = fd.read()
    return json.loads(ungzipped_body.decode('utf-8'), object_hook=decode_node)


class PushTest(QuiltTestCase):
    """
    Unit tests for quilt push.
    """
    def test_push(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        _, pkgroot = store.PackageStore.find_package(None, 'foo', 'bar')
        pkg_hash = hash_contents(pkgroot)
        assert pkg_hash
        contents = pkgroot

        all_hashes = set(find_object_hashes(contents))
        upload_urls = {
            blob_hash: dict(
                head="https://example.com/head/{owner}/{hash}".format(owner='foo', hash=blob_hash),
                put="https://example.com/put/{owner}/{hash}".format(owner='foo', hash=blob_hash)
            ) for blob_hash in all_hashes
        }

        # We will push the package twice, so we're mocking all responses twice.

        for blob_hash in all_hashes:
            urls = upload_urls[blob_hash]

            # First time the package is pushed, s3 HEAD 404s, and we get a PUT.
            self.requests_mock.add(responses.HEAD, urls['head'], status=404)
            self.requests_mock.add(responses.PUT, urls['put'])

            # Second time, s3 HEAD succeeds, and we're not expecting a PUT.
            self.requests_mock.add(responses.HEAD, urls['head'])

        self._mock_put_package('foo/bar', pkg_hash, contents, upload_urls)
        self._mock_put_tag('foo/bar', 'latest')

        self._mock_put_package('foo/bar', pkg_hash, contents, upload_urls)
        self._mock_put_tag('foo/bar', 'latest')

        # Push a new package.
        command.push('foo/bar')

        # Push it again; this time, we're verifying that there are no s3 uploads.
        command.push('foo/bar')

    def test_push_subpackage(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        _, pkgroot = store.PackageStore.find_package(None, 'foo', 'bar')
        contents = pkgroot.children['foo']

        all_hashes = set(find_object_hashes(contents))
        upload_urls = {
            blob_hash: dict(
                head="https://example.com/head/{owner}/{hash}".format(owner='foo', hash=blob_hash),
                put="https://example.com/put/{owner}/{hash}".format(owner='foo', hash=blob_hash)
            ) for blob_hash in all_hashes
        }

        for blob_hash in all_hashes:
            urls = upload_urls[blob_hash]

            self.requests_mock.add(responses.HEAD, urls['head'], status=404)
            self.requests_mock.add(responses.PUT, urls['put'])

        self._mock_update_package('foo/bar', 'foo', contents, upload_urls)

        # Push a subpackage.
        command.push('foo/bar/foo')

    def _mock_put_package(self, package, pkg_hash, contents, upload_urls):
        pkg_url = '%s/api/package/%s/%s' % (command.get_registry_url(None), package, pkg_hash)

        # Dry run, then the real thing.
        def callback1(request):
            data = _decode_body(request.body)
            assert data['dry_run']
            assert data['contents'] == contents
            return (200, {}, json.dumps(dict(upload_urls=upload_urls)))

        def callback2(request):
            data = _decode_body(request.body)
            assert not data['dry_run']
            assert data['contents'] == contents
            return (200, {}, json.dumps(dict(package_url='https://example.com/')))

        self.requests_mock.add_callback(responses.PUT, pkg_url, callback1)
        self.requests_mock.add_callback(responses.PUT, pkg_url, callback2)

    def _mock_update_package(self, package, subpath, contents, upload_urls):
        pkg_url = '%s/api/package_update/%s/%s' % (command.get_registry_url(None), package, subpath)

        # Dry run, then the real thing.
        def callback1(request):
            data = _decode_body(request.body)
            assert data['dry_run']
            assert data['contents'] == contents
            return (200, {}, json.dumps(dict(upload_urls=upload_urls)))

        def callback2(request):
            data = _decode_body(request.body)
            assert not data['dry_run']
            assert data['contents'] == contents
            return (200, {}, json.dumps(dict(package_url='https://example.com/')))

        self.requests_mock.add_callback(responses.POST, pkg_url, callback1)
        self.requests_mock.add_callback(responses.POST, pkg_url, callback2)

    def _mock_put_tag(self, package, tag):
        tag_url = '%s/api/tag/%s/%s' % (command.get_registry_url(None), package, tag)
        self.requests_mock.add(responses.PUT, tag_url, json.dumps(dict()))
