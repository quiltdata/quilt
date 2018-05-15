# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Comments tests
"""

import json
from unittest.mock import patch

import requests

from quilt_server.core import RootNode

from .utils import QuiltTestCase


@patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
class CommentsTestCase(QuiltTestCase):
    """
    Test comments endpoints.
    """
    def _post_comment(self, owner, pkg, user, contents, status=requests.codes.ok):
        resp = self.app.post(
            '/api/comments/{owner}/{pkg}/'.format(owner=owner, pkg=pkg),
            data=json.dumps(dict(contents=contents)),
            content_type='application/json',
            headers={
                'Authorization': user
            } if user else {}
        )
        assert resp.status_code == status
        return json.loads(resp.data.decode('utf-8'))

    def _get_comments(self, owner, pkg, user, status=requests.codes.ok):
        resp = self.app.get(
            '/api/comments/{owner}/{pkg}/'.format(owner=owner, pkg=pkg),
            headers={
                'Authorization': user
            } if user else {}
        )
        assert resp.status_code == status
        return json.loads(resp.data.decode('utf-8'))

    def testPrivateComments(self):
        owner = 'owner'
        pkg1 = 'pkg1'
        pkg2 = 'pkg2'

        user1 = 'user1'
        user2 = 'user2'

        comment1 = 'comment1'
        comment2 = 'comment2'
        comment3 = 'comment3'

        # Create two packages and share with user1.
        self.put_package(owner, pkg1, RootNode(children=dict()))
        self.put_package(owner, pkg2, RootNode(children=dict()))
        self._share_package(owner, pkg1, user1)
        self._share_package(owner, pkg2, user1)

        # Post comments on both packages.
        resp = self._post_comment(owner, pkg1, owner, comment1)['comment']
        assert resp['author'] == owner
        assert resp['contents'] == comment1
        assert resp['created']
        assert len(resp['id']) == 16
        self._post_comment(owner, pkg1, user1, comment2)
        self._post_comment(owner, pkg2, user1, comment3)

        # User2 can't see the package, so can't post comments.
        self._post_comment(owner, pkg1, user2, 'Hello', status=requests.codes.not_found)

        # Same for anonymous.
        self._post_comment(owner, pkg1, None, 'Hello', status=requests.codes.unauthorized)

        # View the comments.
        comments = self._get_comments(owner, pkg1, user1)['comments']
        assert len(comments) == 2
        assert comments[0]['author'] == owner
        assert comments[0]['contents'] == comment1
        assert comments[0]['created']
        assert comments[1]['author'] == user1
        assert comments[1]['contents'] == comment2
        assert comments[1]['created']
        assert comments[0]['id'] != comments[1]['id']

        comments = self._get_comments(owner, pkg2, user1)['comments']
        assert len(comments) == 1
        assert comments[0]['author'] == user1
        assert comments[0]['contents'] == comment3

        # User2 and anonymous can't view the comments.
        self._get_comments(owner, pkg1, user2, status=requests.codes.not_found)
        self._get_comments(owner, pkg1, None, status=requests.codes.not_found)

    def testPublicComments(self):
        owner = 'owner'
        pkg1 = 'pkg1'
        user1 = 'user1'
        comment1 = 'comment1'

        self.put_package(owner, pkg1, RootNode(children=dict()), is_public=True)

        # Post a comments.
        self._post_comment(owner, pkg1, user1, comment1)

        # Anonymous still can't post.
        self._post_comment(owner, pkg1, None, 'Hello', status=requests.codes.unauthorized)

        # View the comments as user1.
        comments = self._get_comments(owner, pkg1, user1)['comments']
        assert len(comments) == 1
        assert comments[0]['author'] == user1
        assert comments[0]['contents'] == comment1

        # View comments as anonymous.
        comments = self._get_comments(owner, pkg1, None)['comments']
        assert len(comments) == 1
        assert comments[0]['author'] == user1
        assert comments[0]['contents'] == comment1
