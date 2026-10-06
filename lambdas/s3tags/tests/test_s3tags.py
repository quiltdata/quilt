import base64
import hashlib
import io
import json

import pytest

import t4_lambda_s3tags as m

CONFIG = {'project': '/project', 'stage': '/a/stage'}
LOAD_CONFIG = m.load_config


def test_project_and_merge():
    projected = m.project(CONFIG, {'project': 'apollo', 'a': {'stage': {'x': 1}}})
    # `stage` can't be a tag, so the existing value stays; foreign tags stay too.
    assert projected == {'project': 'apollo'}
    assert m.merge(projected, CONFIG, {'owner': 'ops', 'project': 'old', 'stage': 'dev'}) == {
        'owner': 'ops',
        'project': 'apollo',
        'stage': 'dev',
    }
    assert m.merge({'project': None}, CONFIG, {'project': 'old'}) == {}


class FakeS3:
    class exceptions:
        NoSuchKey = KeyError

    def __init__(self, objects, tags):
        self.objects = objects
        self.tags = tags
        self.puts = []

    def get_object(self, Bucket, Key):
        return {'Body': io.BytesIO(self.objects[(Bucket, Key)])}

    def get_paginator(self, _):
        objects = self.objects

        class P:
            def paginate(self, Bucket, Prefix):
                yield {'Contents': [{'Key': k} for (b, k) in objects if b == Bucket and k.startswith(Prefix)]}

        return P()

    def get_object_tagging(self, Bucket, Key, VersionId=None):
        return {'TagSet': [{'Key': k, 'Value': v} for k, v in self.tags.get(Key, {}).items()]}

    def put_object_tagging(self, Bucket, Key, Tagging, VersionId=None):
        self.puts.append((Key, VersionId, {t['Key']: t['Value'] for t in Tagging['TagSet']}))


def manifest(user_meta, keys):
    lines = [json.dumps({'version': 'v0', 'user_meta': user_meta})]
    lines += [json.dumps({'logical_key': 'dir/', 'meta': {}})]
    lines += [json.dumps({'logical_key': k, 'physical_keys': [k]}) for k in keys]
    return '\n'.join(lines).encode()


@pytest.fixture
def fake(monkeypatch):
    objects = {
        ('b', '.quilt/named_packages/a/b/1700000000'): b'old',
        ('b', '.quilt/named_packages/a/b/1700000100'): b'new',
        ('b', '.quilt/named_packages/a/b/latest'): b'old',
        ('b', '.quilt/packages/new'): manifest(
            {'project': 'apollo'},
            ['s3://b/f1?versionId=v1', 's3://b/f2?versionId=v1', 's3://other/f?versionId=v1'],
        ),
    }
    s3 = FakeS3(objects, {'f1': {'owner': 'ops'}, 'f2': {'project': 'apollo'}})
    monkeypatch.setattr(m, 's3', s3)
    monkeypatch.setattr(m, 'load_config', {'b': {'project': '/project'}}.get)
    return s3


def test_project_revision_tags_in_bucket_versions(fake):
    # `latest` still names the old hash, as it does when the event arrives.
    assert m.project_revision('b', 'a/b', 'new') == {'tagged': 1, 'unchanged': 1, 'other-bucket': 1}
    assert fake.puts == [('f1', 'v1', {'owner': 'ops', 'project': 'apollo'})]


def test_handler_fails_messages_with_tagging_errors(fake):
    def denied(**kwargs):
        raise m.botocore.exceptions.ClientError({'Error': {'Code': 'AccessDenied'}}, 'PutObjectTagging')

    fake.put_object_tagging = denied
    records = [
        {'messageId': 'ok', 'body': json.dumps({'detail': {'bucket': 'b', 'handle': 'a/b', 'topHash': 'old'}})},
        {'messageId': 'denied', 'body': json.dumps({'detail': {'bucket': 'b', 'handle': 'a/b', 'topHash': 'new'}})},
        {'messageId': 'bad', 'body': '{}'},
    ]
    assert m.handler({'Records': records}, None) == {
        'batchItemFailures': [{'itemIdentifier': 'denied'}, {'itemIdentifier': 'bad'}]
    }


def test_superseded_revision_is_skipped(fake):
    assert m.project_revision('b', 'a/b', 'old') == {}
    assert fake.puts == []


def test_load_config_signs_the_request(monkeypatch):
    signed = {}

    class FakeKMS:
        def sign(self, **kwargs):
            signed.update(kwargs)
            return {'Signature': b'SIG'}

    def urlopen(req, timeout):
        assert req.full_url == 'http://registry:8080/s3tags/buckets/my%2Fbucket'
        assert req.get_method() == 'POST'
        assert req.get_header('X-quilt-signature') == base64.b64encode(b'SIG').decode()
        assert signed['Message'] == hashlib.sha512(req.data).digest()
        return io.BytesIO(b'{"tags": {"project": "/project"}}')

    monkeypatch.setattr(m, 'kms', FakeKMS())
    monkeypatch.setattr(m, 'REGISTRY_ENDPOINT', 'http://registry:8080/s3tags/')
    monkeypatch.setattr(m.urllib.request, 'urlopen', urlopen)
    assert m.load_config('my/bucket') == {'project': '/project'}
    assert signed['MessageType'] == 'DIGEST' and signed['SigningAlgorithm'] == 'RSASSA_PSS_SHA_512'


def test_unmapped_bucket_is_skipped(fake, monkeypatch):
    class FakeKMS:
        def sign(self, **kwargs):
            return {'Signature': b'SIG'}

    monkeypatch.setattr(m, 'load_config', LOAD_CONFIG)
    monkeypatch.setattr(m, 'kms', FakeKMS())
    monkeypatch.setattr(m, 'REGISTRY_ENDPOINT', 'http://registry:8080/s3tags/')
    monkeypatch.setattr(m.urllib.request, 'urlopen', lambda req, timeout: io.BytesIO(b'{"tags": null}'))
    assert m.project_revision('b', 'a/b', 'new') == {}
    assert fake.puts == []
