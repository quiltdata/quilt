# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Test push and install endpoints.
"""

import json
from unittest.mock import patch
import urllib

import requests

from quilt_server import app, db
from quilt_server.const import PaymentPlan
from quilt_server.core import (
    decode_node,
    encode_node,
    hash_contents,
    GroupNode,
    TableNode,
    FileNode,
    RootNode,
    PackageFormat,
)
from quilt_server.models import InstanceBlobAssoc, S3Blob

from .utils import mock_customer, QuiltTestCase


class PushInstallTestCase(QuiltTestCase):
    """
    Test push and install endpoints.
    """

    HASH1 = 'd146942c9a051553f77d1e00672f2829565c590be972a1330de726a8db223589'
    HASH2 = '4cf37d7f670709346438cf2f2598db630eb34520947308aed55ad5e53f0c1518'
    HASH3 = '46449f44f36ec78364ae846fa47df57870e49d3c6cee59b3682aaf289e6d7586'

    CONTENTS = RootNode(dict(
        foo=TableNode(
            hashes=[HASH1, HASH2],
            format=PackageFormat.default.value
        ),
        group1=GroupNode(dict(
            empty=TableNode(
                hashes=[],
                format=PackageFormat.default.value
            ),
            group2=GroupNode(dict(
                bar=TableNode(
                    hashes=[HASH1],
                    format=PackageFormat.default.value
                )
            ))
        )),
        file=FileNode(
            hashes=[HASH3],
            metadata={'q_path': 'example'}
        )
    ))

    CONTENTS_WITH_METADATA = RootNode(dict(
        foo=TableNode(
            hashes=[HASH1, HASH2],
            format=PackageFormat.default.value,
            metadata=dict(
                important=True
            )
        ),
        group1=GroupNode(dict(
            empty=TableNode(
                hashes=[],
                format=PackageFormat.default.value,
                metadata=dict(
                    whatever="123"
                )
            ),
            group2=GroupNode(dict(
                bar=TableNode([HASH1], PackageFormat.default.value)
            ))
        )),
        file=FileNode(
            hashes=[HASH3],
            metadata=dict()
        )
    ))

    CONTENTS_2 = RootNode(dict(
        file=FileNode(
            hashes=[HASH3]
        )
    ))

    HUGE_CONTENTS = RootNode(dict(
        README=FileNode(
            hashes=[HASH1]
        ),
        group1=GroupNode(dict(
            group2=GroupNode(dict(
                group3=GroupNode(dict(
                    group4=GroupNode(dict(
                        group5=GroupNode(dict(
                            group6=GroupNode(dict())
                        ))
                    ))
                ))
            ))
        )),
        big_group=GroupNode({
            'child%02d' % i: GroupNode(dict())
            for i in range(1, 21)
        })
    ))

    CONTENTS_WITH_Q_EXT = RootNode(dict(
        file1=FileNode(hashes=[HASH1], metadata=dict()),
        file2=FileNode(hashes=[HASH1], metadata=dict(
            q_path=None
        )),
        file3=FileNode(hashes=[HASH1], metadata=dict(
            q_path=''
        )),
        file4=FileNode(hashes=[HASH1], metadata=dict(
            q_path='a/b.c/d.jpg'
        )),
        file5=FileNode(hashes=[HASH1], metadata=dict(
            q_path='C:\\Windows\\System32\\clock.exe'
        )),
        file6=FileNode(hashes=[HASH1], metadata=dict(
            q_path='C:\\foo.bar\\BLAH.JPG'
        )),
        README=FileNode(hashes=[HASH2], metadata=dict(
            q_path='README'
        ))
    ))

    CONTENTS_HASH = 'a20597100b045f5420de46b7188590e8688bcfe2ac01e9cbefe26f8919b3f44d'
    CONTENTS_2_HASH = 'ede3e3b8d0d3df8503aa9b27d592b5e27281f929cb440a556a2d0c3c52a912e7'

    def testContentsHash(self):
        assert hash_contents(self.CONTENTS) == self.CONTENTS_HASH
        assert hash_contents(self.CONTENTS_WITH_METADATA) == self.CONTENTS_HASH

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testSuccessfulPushInstall(self):
        """
        Push a package, then install it.
        """
        # Push a package.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS,
                sizes={self.HASH1: 1, self.HASH2: 2, self.HASH3: 3}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        assert data['package_url'] == 'http://localhost:3000/package/test_user/foo'

        # List user's packages.
        resp = self.app.get(
            '/api/package/test_user/',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        assert data['packages'] == [dict(name='foo', is_public=True, is_team=False)]

        # List package instances.
        resp = self.app.get(
            '/api/package/test_user/foo/',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        assert data['hashes'] == [self.CONTENTS_HASH]

        # Install the package.
        resp = self.app.get(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Install the package as an anonymous user.
        resp = self.app.get(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)
        contents = data['contents']
        assert contents == self.CONTENTS
        assert data['sizes'] == {self.HASH1: 1, self.HASH2: 2, self.HASH3: 3}
        assert data['created_by'] == data['updated_by'] == 'test_user'
        assert data['created_at'] == data['updated_at']
        urls = data['urls']
        assert len(urls) == 3

        url1 = urllib.parse.urlparse(urls[self.HASH1])
        url2 = urllib.parse.urlparse(urls[self.HASH2])
        url3 = urllib.parse.urlparse(urls[self.HASH3])
        assert url1.path == '/%s/objs/test_user/%s' % (app.config['PACKAGE_BUCKET_NAME'], self.HASH1)
        assert url2.path == '/%s/objs/test_user/%s' % (app.config['PACKAGE_BUCKET_NAME'], self.HASH2)
        assert url3.path == '/%s/objs/test_user/%s' % (app.config['PACKAGE_BUCKET_NAME'], self.HASH3)

        # Install just the metadata.
        resp = self.app.get(
            '/api/package/test_user/foo/%s?meta_only=true' % self.CONTENTS_HASH,
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)
        contents = data['contents']
        assert contents == self.CONTENTS
        assert not data['sizes']
        assert not data['urls']

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testPushNewMetadata(self):
        # Push the original contents.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Push the metadata.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS_WITH_METADATA
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Verify that the metadata got saved.
        resp = self.app.get(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)
        assert data['contents'] == self.CONTENTS_WITH_METADATA

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testNotLoggedIn(self):
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json'
        )
        assert resp.status_code == requests.codes.unauthorized

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

        resp = self.app.get(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
        )
        assert resp.status_code == requests.codes.not_found

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testCreateWrongUser(self):
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'bad_user'
            }
        )
        assert resp.status_code == requests.codes.forbidden

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testInvalidRequest(self):
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data='hello',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.bad_request

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.bad_request

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testInvalidHash(self):
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.HASH1,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.bad_request

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testInvalidPackageName(self):
        resp = self.app.put(
            '/api/package/test_user/bad-name/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.bad_request

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testCase(self):
        # Can't create a package if the username has the wrong case.
        resp = self.app.put(
            '/api/package/Test_User/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.forbidden

        # Successfully create a package.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Can't update with the wrong username case.
        resp = self.app.put(
            '/api/package/Test_User/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.forbidden

        # Can't update with the wrong package name case.
        resp = self.app.put(
            '/api/package/test_user/Foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.forbidden

        # Can't install with the wrong case.
        # TODO: Special error for this one.
        resp = self.app.get(
            '/api/package/test_user/Foo/%s' % self.CONTENTS_HASH,
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.not_found

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    @mock_customer(plan=PaymentPlan.INDIVIDUAL)
    def testCreatePublic(self, customer):
        # Create a new public package.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Verify that it's public.
        resp = self.app.get('/api/package/test_user/foo/')
        assert resp.status_code == requests.codes.ok

        # Create a private package.
        resp = self.app.put(
            '/api/package/test_user/bar/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        # Verify that it's private.
        resp = self.app.get('/api/package/test_user/bar/')
        assert resp.status_code == requests.codes.not_found

        # Try pushing it again as public, and verify that it fails.
        resp = self.app.put(
            '/api/package/test_user/bar/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.forbidden

    @mock_customer()
    def testCreatePrivateOnFreePlan(self, customer):
        # Need to upgrade the plan.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user',
            }
        )
        assert resp.status_code == requests.codes.payment_required
        data = json.loads(resp.data.decode('utf8'))
        assert "upgrade your service plan" in data['message']

    def testCreatePrivateNoPayments(self):
        # Payments disabled; no restrictions on private packages.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user',
            }
        )
        assert resp.status_code == requests.codes.ok

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testDryRun(self):
        # Create a new package.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                dry_run=True,
                is_public=True,
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Check that dry run returned signed URLs.
        data = json.loads(resp.data.decode('utf8'))
        urls = data['upload_urls']
        assert len(urls) == 3

        for obj_hash in (self.HASH1, self.HASH2, self.HASH3):
            for method in ('head', 'put'):
                url = urllib.parse.urlparse(urls[obj_hash][method])
                assert url.path == '/%s/objs/test_user/%s' % (
                    app.config['PACKAGE_BUCKET_NAME'], obj_hash
                )

        # Verify that it doesn't actually exist.
        resp = self.app.get(
            '/api/package/test_user/bar/',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.not_found

        # Check that dry-run errors are useful.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % 'bad hash',
            data=json.dumps(dict(
                dry_run=True,
                is_public=True,
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.bad_request

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testInstallSubpath(self):
        """
        Push a package, then install it a subpath.
        """
        # Push a package.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS,
                sizes={self.HASH1: 1, self.HASH2: 2, self.HASH3: 3}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Install table "foo".
        resp = self.app.get(
            '/api/package/test_user/foo/%s?%s' % (
                self.CONTENTS_HASH,
                urllib.parse.urlencode(dict(subpath='foo')),
            ),
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)
        contents = data['contents']
        assert contents == self.CONTENTS
        assert data['sizes'] == {self.HASH1: 1, self.HASH2: 2}
        urls = data['urls']
        assert len(urls) == 2  # HASH1 and HASH2

        # Install group "group1/group2".
        resp = self.app.get(
            '/api/package/test_user/foo/%s?%s' % (
                self.CONTENTS_HASH,
                urllib.parse.urlencode(dict(subpath='group1/group2')),
            ),
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)
        contents = data['contents']
        assert contents == self.CONTENTS
        urls = data['urls']
        assert len(urls) == 1  # Just HASH1

        # Install a non-existant group.
        resp = self.app.get(
            '/api/package/test_user/foo/%s?%s' % (
                self.CONTENTS_HASH,
                urllib.parse.urlencode(dict(subpath='zzz')),
            ),
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.not_found

        # Install a child of a non-group.
        resp = self.app.get(
            '/api/package/test_user/foo/%s?%s' % (
                self.CONTENTS_HASH,
                urllib.parse.urlencode(dict(subpath='foo/zzz')),
            ),
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.not_found

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testPackageTimeseries(self):
        huge_contents_hash = hash_contents(self.HUGE_CONTENTS)

        readme_contents = 'Hello, World!'
        self._mock_object('test_user', self.HASH1, readme_contents.encode())
        # Push
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % huge_contents_hash,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.HUGE_CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Get timeseries
        resp = self.app.get(
            '/api/package_timeseries/test_user/foo/install',
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)
        assert data['total'] == 0
        assert data['startDate'] < data['endDate']
        assert data['timeSeries'] == [0] * 52
        assert data['frequency'] == 'week'

        # install as anonymous user
        resp = self.app.get(
            '/api/package/test_user/foo/%s' % huge_contents_hash,
        )
        assert resp.status_code == requests.codes.ok

        # Get timeseries again
        # Get timeseries
        resp = self.app.get(
            '/api/package_timeseries/test_user/foo/install',
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)
        assert data['total'] == 1
        assert data['startDate'] < data['endDate']
        assert data['timeSeries'] == [0] * 51 + [1]
        assert data['frequency'] == 'week'
        

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testPreview(self):
        huge_contents_hash = hash_contents(self.HUGE_CONTENTS)

        readme_contents = 'Hello, World!'
        self._mock_object('test_user', self.HASH1, readme_contents.encode())

        # Push.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % huge_contents_hash,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.HUGE_CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Get preview.
        resp = self.app.get(
            '/api/package_preview/test_user/foo/%s' % huge_contents_hash,
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Get preview as an anonymous user.
        resp = self.app.get(
            '/api/package_preview/test_user/foo/%s' % huge_contents_hash,
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)
        assert data['is_public'] == True
        assert data['is_team'] == False
        assert data['readme_url']
        assert data['readme_preview'] == readme_contents
        preview = data['preview']

        assert preview == [
            ['README', None],
            ['big_group', [
                ['child01', []],
                ['child02', []],
                ['child03', []],
                ['child04', []],
                ['child05', []],
                ['child06', []],
                ['child07', []],
                ['child08', []],
                ['child09', []],
                ['child10', []],
                ['...', None],
            ]],
            ['group1', [
                ['group2', [
                    ['group3', [
                        ['group4', [
                            ['...', None]
                        ]]
                    ]]
                ]]
            ]],
        ]

        # install as anonymous user
        resp = self.app.get(
            '/api/package/test_user/foo/%s' % huge_contents_hash,
        )
        assert resp.status_code == requests.codes.ok

        # get new preview
        resp = self.app.get(
            '/api/package_preview/test_user/foo/%s' % huge_contents_hash,
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testPreviewStats(self):
        contents_hash = hash_contents(self.CONTENTS_WITH_Q_EXT)

        readme_contents = 'Hello, World!'
        self._mock_object('test_user', self.HASH2, readme_contents.encode())

        # Push.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % contents_hash,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS_WITH_Q_EXT,
                sizes={
                    self.HASH1: 5,
                    self.HASH2: 37
                }
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Get preview.
        resp = self.app.get(
            '/api/package_preview/test_user/foo/%s' % contents_hash,
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)
        assert data['total_size_uncompressed'] == 42
        assert data['file_types'] == {
            '': 4,
            '.jpg': 2,
            '.exe': 1
        }

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testReadmeDownload(self):
        readme_contents = '123'

        # Upload a package with no README.
        contents1 = RootNode(dict(
            foo=FileNode(
                hashes=[self.HASH1]
            )
        ))
        self.put_package('test_user', 'foo', contents1, is_public=True)

        # Upload a package with a README that has the same hash as an existing object.
        # README should now get downloaded.
        contents2 = RootNode(dict(
            README=FileNode(
                hashes=[self.HASH1]
            )
        ))
        self._mock_object('test_user', self.HASH1, readme_contents.encode())
        self.put_package('test_user', 'foo', contents2, is_public=True)
        self.s3_stubber.assert_no_pending_responses()

        # Upload a different package with the same README. Nothing should get downloaded.
        contents3 = RootNode(dict(
            README=FileNode(
                hashes=[self.HASH1]
            ),
            bar=GroupNode(dict())
        ))
        self.put_package('test_user', 'foo2', contents3, is_public=True)

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testInstanceBlob(self):
        # Verify that all blobs are accounted for in the instance<->blob table.

        # Push the first instance with three blobs.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        blobs = S3Blob.query.all()
        instance_blobs = db.session.query(InstanceBlobAssoc).all()

        assert len(blobs) == 3
        assert len(instance_blobs) == 3

        # Push the second instance, which reuses one of the blobs.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_2_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS_2
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        blobs = S3Blob.query.all()
        instance_blobs = db.session.query(InstanceBlobAssoc).all()

        assert len(blobs) == 3
        assert len(instance_blobs) == 4

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    @patch('quilt_server.views.ALLOW_TEAM_ACCESS', False)
    def testTeamAccessFails(self):
        # Verify that --team fails in the public cloud.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_team=True,
                description="",
                contents=self.CONTENTS,
                sizes={self.HASH1: 1, self.HASH2: 2, self.HASH3: 3}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.forbidden

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', False)
    @patch('quilt_server.views.ALLOW_TEAM_ACCESS', True)
    def testTeams(self):
        # Public push fails.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS,
                sizes={self.HASH1: 1, self.HASH2: 2, self.HASH3: 3}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.forbidden

        # Team push succeeds.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                is_team=True,
                description="",
                contents=self.CONTENTS,
                sizes={self.HASH1: 1, self.HASH2: 2, self.HASH3: 3}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testOldPublicParamn(self):
        # Push a package using "public" rather than "is_public".
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                public=True,
                description="",
                contents=self.CONTENTS,
                sizes={self.HASH1: 1, self.HASH2: 2, self.HASH3: 3}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        # Verify that "is_public" is set.
        resp = self.app.get(
            '/api/package/test_user/',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        assert data['packages'] == [dict(name='foo', is_public=True, is_team=False)]

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testPushSubpackage(self):
        # Pushing a subpackage fails until the package is created the normal way.
        resp = self.app.post(
            '/api/package_update/test_user/foo/group1/group2',
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=RootNode(dict(
                    group1=GroupNode(dict(
                        group2=GroupNode(dict())
                    ))
                )),
                sizes={}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.not_found

        # Do a normal push.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_2_HASH,
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=self.CONTENTS_2,
                sizes={self.HASH3: 3}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Subpackage push _still_ fails cause there's no "latest" tag.
        resp = self.app.post(
            '/api/package_update/test_user/foo/group1/group2',
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=RootNode(dict(
                    group1=GroupNode(dict(
                        group2=GroupNode(dict())
                    ))
                )),
                sizes={}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.not_found

        # Set the "latest" tag.
        resp = self.app.put(
            '/api/tag/test_user/foo/latest',
            data=json.dumps(dict(
                hash=self.CONTENTS_2_HASH
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Now we can push a subpackage.
        resp = self.app.post(
            '/api/package_update/test_user/foo/group1/group2',
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=RootNode(dict(
                    group1=GroupNode(dict(
                        group2=GroupNode(dict())
                    ))
                )),
                sizes={}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # READMEs get downloaded as usual, too.
        readme_contents = 'Blah'
        self._mock_object('test_user', self.HASH1, readme_contents.encode())
        resp = self.app.post(
            '/api/package_update/test_user/foo/README',
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=RootNode(dict(
                    README=FileNode([self.HASH1])
                )),
                sizes={self.HASH1: 1}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'), object_hook=decode_node)
        package_hash = data['package_hash']
        contents = data['contents']

        # Can't push a non-existent subpath.
        resp = self.app.post(
            '/api/package_update/test_user/foo/group3',
            data=json.dumps(dict(
                is_public=True,
                description="",
                contents=RootNode(dict(
                    group1=GroupNode(dict())
                )),
                sizes={}
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.not_found

        # Install the package and verify that it has everything.
        resp = self.app.get(
            '/api/tag/test_user/foo/latest',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        # Verify that the "latest" tag points to the last hash we got from a subpackage push.
        assert data['hash'] == package_hash

        # Verify that the contents is everything we've pushed so far.
        assert contents == RootNode(dict(
            file=FileNode([self.HASH3]),
            README=FileNode([self.HASH1]),
            group1=GroupNode(dict(
                group2=GroupNode(dict())
            ))
        ))
