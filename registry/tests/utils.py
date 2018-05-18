# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Unittest setup.
"""

from functools import wraps
import gzip
import json
from io import BytesIO
import random
import string
from unittest import mock, TestCase
from unittest.mock import patch

from botocore.stub import Stubber
from mixpanel import Mixpanel
import requests
import responses
import sqlalchemy_utils

import quilt_server
from quilt_server.auth import _create_user, get_user, verify_token_string
from quilt_server.const import PaymentPlan
from quilt_server.core import encode_node, hash_contents
from quilt_server.views import s3_client, MAX_PREVIEW_SIZE

class MockMixpanelConsumer(object):
    """
    Mock Mixpanel consumer that just logs the events to stdout.
    """
    def send(self, endpoint, message):
        """
        Logs the event.
        """
        print("%s: %s" % (endpoint, message))

class QuiltTestCase(TestCase):
    """
    Base class for unittests.
    - Creates a test client
    - Creates and drops a test database
    - Mocks requests
    """
    def setUp(self):
        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()

        mock_mp = Mixpanel('dummy_token', MockMixpanelConsumer())
        self.mp_patcher = mock.patch('quilt_server.views.mp', mock_mp)
        self.mp_patcher.start()

        self.payments_patcher = mock.patch('quilt_server.views.HAVE_PAYMENTS', False)
        self.payments_patcher.start()

        self.s3_stubber = Stubber(s3_client)
        self.s3_stubber.activate()

        random_name = ''.join(random.sample(string.ascii_lowercase, 10))
        self.db_url = 'postgresql://postgres@localhost/test_%s' % random_name

        def mock_verify(username_or_token):
            user = get_user(username_or_token)
            if user:
                return user
            else:
                return verify_token_string(username_or_token)

        # instead of checking token, just use username
        self.token_verify_mock = mock.patch('quilt_server.views.verify_token_string', mock_verify)
        self.token_verify_mock.start()


        self.app = quilt_server.app.test_client()
        quilt_server.app.config['TESTING'] = True
        quilt_server.app.config['SQLALCHEMY_ECHO'] = False
        quilt_server.app.config['SQLALCHEMY_DATABASE_URI'] = self.db_url

        sqlalchemy_utils.create_database(self.db_url)
        quilt_server.db.create_all()

        _create_user('test_user', email='test_user@example.com',
                requires_activation=False, force=True)
        _create_user('admin', email='admin@example.com',
                requires_activation=False, is_admin=True, force=True)
        _create_user('bad_user', email='bad_user@example.com',
                requires_activation=False, force=True)
        _create_user('share_with', email='share_with@example.com',
                requires_activation=False, force=True)
        _create_user('user1', email='user1@example.com',
                requires_activation=False, force=True)
        _create_user('user2', email='user2@example.com',
                requires_activation=False, force=True)


    def tearDown(self):
        quilt_server.db.session.remove()
        quilt_server.db.drop_all()
        sqlalchemy_utils.drop_database(self.db_url)

        self.s3_stubber.deactivate()
        self.payments_patcher.stop()
        self.mp_patcher.stop()

        self.requests_mock.stop()

    def _mock_email(self):
        """Mocks the auth API call and just returns the value of the Authorization header"""
        invite_url = quilt_server.app.config['INVITE_SEND_URL']
        self.requests_mock.add(responses.POST, invite_url, json.dumps(dict()))

    def _mock_user(self):
        """Mocks the auth API call and just returns the value of the Authorization header"""
        user_url = quilt_server.app.config['OAUTH']['user_api']

        def cb(request):
            auth = request.headers.get('Authorization')
            if auth is None:
                return (401, {}, "Not logged in")
            else:
                # Hack to make it easy to simulate admin users:
                # if the username is "admin", it's an "admin".
                is_staff = auth == 'admin'
                return (200, {}, json.dumps(dict(
                    current_user=auth,
                    email='%s@example.com' % auth,
                    is_staff=is_staff
                )))

        self.requests_mock.add_callback(responses.GET, user_url, callback=cb)

    def _mock_check_user(self, user):
        """Mocks the username check call and returns just the username"""
        user_url = quilt_server.app.config['OAUTH']['profile_api'] % user
        self.requests_mock.add(responses.GET, user_url, json.dumps(dict(username=user)))

    def put_package(self, owner, package, contents, is_public=False, is_team=False, tag_latest=False):
        contents_hash = hash_contents(contents)
        pkgurl = '/api/package/{usr}/{pkg}/{hash}'.format(
            usr=owner,
            pkg=package,
            hash=contents_hash
        )

        resp = self.app.put(
            pkgurl,
            data=json.dumps(dict(
                description="",
                contents=contents,
                is_public=is_public,
                is_team=is_team,
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': owner
            }
        )
        assert resp.status_code == requests.codes.ok

        if tag_latest:
            resp = self.app.put(
                '/api/tag/{usr}/{pkg}/{tag}'.format(
                    usr=owner,
                    pkg=package,
                    tag='latest'
                ),
                data=json.dumps(dict(
                    hash=contents_hash
                )),
                content_type='application/json',
                headers={
                    'Authorization': owner
                }
            )
            assert resp.status_code == requests.codes.ok

        return pkgurl

    def _share_package(self, owner, pkg, other_user):
        self._mock_check_user(other_user)

        return self.app.put(
            '/api/access/{owner}/{pkg}/{usr}'.format(
                owner=owner, usr=other_user, pkg=pkg
            ),
            headers={
                'Authorization': owner
            }
        )

    def _unshare_package(self, owner, pkg, other_user):
        return self.app.delete(
            '/api/access/{owner}/{pkg}/{usr}'.format(
                owner=owner, usr=other_user, pkg=pkg
            ),
            headers={
                'Authorization': owner
            }
        )

    def _mock_object(self, owner, blob_hash, contents):
        contents_gzipped = gzip.compress(contents)

        self.s3_stubber.add_response('get_object', dict(
            Body=BytesIO(contents_gzipped)
        ), dict(
            Bucket=quilt_server.app.config['PACKAGE_BUCKET_NAME'],
            Key='objs/%s/%s' % (owner, blob_hash),
            Range='bytes=-%d' % MAX_PREVIEW_SIZE
        ))


def mock_customer(plan=PaymentPlan.FREE, have_credit_card=False):
    def innerdec(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            customer = mock.MagicMock()

            customer.subscriptions.total_count = 1
            customer.subscriptions.data[0].plan.id = plan.value
            customer.sources.total_count = 1 if have_credit_card else 0

            args += (customer,)

            with mock.patch('quilt_server.views._get_or_create_customer', return_value=customer):
                with mock.patch('quilt_server.views.HAVE_PAYMENTS', True):
                    return f(*args, **kwargs)

        return wrapper
    return innerdec
