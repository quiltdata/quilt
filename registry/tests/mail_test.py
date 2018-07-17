import unittest
from unittest import mock
from unittest.mock import patch

from .utils import QuiltTestCase

from quilt_server import app
from quilt_server.models import User
from quilt_server.mail import (send_new_user_email, send_invitation_email,
    send_activation_email, send_reset_email, send_comment_email)

class MailTestCase(QuiltTestCase):

    def setUp(self):
        super(MailTestCase, self).setUp()

    @patch('quilt_server.mail.send_email')
    def testTemplates(self, send_email):
        # just make sure all templates work
        test_user = User.query.filter_by(name=self.TEST_USER).one_or_none()
        with app.app_context():
            send_new_user_email(self.TEST_USER, self.TEST_USER_EMAIL,
                    ['admin@example.com', 'admin2@example.com'])
            send_invitation_email(self.TEST_USER_EMAIL, self.OTHER_USER, 'test')
            send_reset_email(test_user, 'test')
            send_activation_email(test_user, 'test')
            send_comment_email(self.TEST_USER_EMAIL, 'test', 'pkg', 'commenting_user',
                    'http://localhost:3000/test/pkg/#comments')

    @patch('quilt_server.mail.send_email')
    def testLinkWorksCorrectly(self, send_email):
        test_user = User.query.filter_by(name=self.TEST_USER).one_or_none()
        test_link = '123456789'
        expected_test_link = 'http://localhost:5000/activate/123456789'
        with app.app_context():
            send_activation_email(test_user, test_link)
            send_reset_email(test_user, test_link)
        assert send_email.called
        call = send_email.call_args_list[0][1]
        html = call['html']
        body = call['body']
        assert html.find(expected_test_link) != -1
        assert body.find(expected_test_link) != -1

        expected_test_link = 'http://localhost:3000/reset_password/123456789'
        call = send_email.call_args_list[1][1]
        html = call['html']
        body = call['body']
        assert html.find(expected_test_link) != -1
        assert body.find(expected_test_link) != -1
