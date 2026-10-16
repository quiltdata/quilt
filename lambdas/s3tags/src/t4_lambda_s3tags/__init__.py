"""Project package metadata onto S3 object tags.

Consumes `com.quiltdata` `package-revision` events (from lambdas/pkgevents) via SQS.
Admins map buckets in the registry: `{<tag key>: <JSON pointer into user_meta>}`, read from a
registry endpoint that verifies the request against the stack's S3 tags KMS key.
"""

import base64
import concurrent.futures
import hashlib
import json
import logging
import os
import re
import urllib.parse
import urllib.request

import boto3
import botocore.config
import botocore.exceptions

# e.g. http://registry.<stack>:8080/s3tags/
REGISTRY_ENDPOINT = os.environ.get('REGISTRY_ENDPOINT', '')
KMS_KEY_ID = os.environ.get('KMS_KEY_ID', '')
REGISTRY_TIMEOUT = 30
MANIFESTS_PREFIX = '.quilt/packages/'
NAMED_PACKAGES_PREFIX = '.quilt/named_packages/'
POINTER_RE = re.compile(r'[0-9]{10}')
# S3 object tag limits.
MAX_TAGS = 10
MAX_VALUE_LENGTH = 256
ALLOWED_CHARS = re.compile(r'[\w .:/=+\-@]*')
TAGGING_CONCURRENCY = 16
# Outcomes that retrying the revision cannot change; any other error code fails the message.
FINAL_OUTCOMES = {'tagged', 'unchanged', 'too-many-tags', 'other-bucket', 'NoSuchKey', 'NoSuchVersion'}

logger = logging.getLogger(__name__)
s3 = boto3.client('s3', config=botocore.config.Config(max_pool_connections=TAGGING_CONCURRENCY))
kms = boto3.client('kms')


def load_config(bucket: str) -> dict[str, str] | None:
    """The bucket's mapping, validated by the registry on save; None when it maps nothing."""
    body = b'{}'
    signature = kms.sign(
        KeyId=KMS_KEY_ID,
        Message=hashlib.sha512(body).digest(),
        MessageType='DIGEST',
        SigningAlgorithm='RSASSA_PSS_SHA_512',
    )['Signature']
    req = urllib.request.Request(
        f'{REGISTRY_ENDPOINT}buckets/{urllib.parse.quote(bucket, safe="")}',
        data=body,
        method='POST',
        headers={'Content-Type': 'application/json', 'x-quilt-signature': base64.b64encode(signature).decode()},
    )
    with urllib.request.urlopen(req, timeout=REGISTRY_TIMEOUT) as resp:
        return json.load(resp)['tags']


def get_pointer(meta: dict, pointer: str):
    value = meta
    for part in pointer[1:].split('/'):
        part = part.replace('~1', '/').replace('~0', '~')
        if isinstance(value, dict):
            value = value.get(part)
        elif isinstance(value, list) and part.isdigit() and int(part) < len(value):
            value = value[int(part)]
        else:
            return None
    return value


def project(config: dict[str, str], user_meta: dict) -> dict[str, str | None]:
    """Tag key -> value to write, None to remove; keys whose value can't be a tag are left out."""
    projected = {}
    for key, pointer in config.items():
        raw = get_pointer(user_meta, pointer)
        if raw is None:
            projected[key] = None
        elif isinstance(raw, (str, int, float, bool)):
            value = json.dumps(raw) if isinstance(raw, bool) else str(raw)
            if len(value) <= MAX_VALUE_LENGTH and ALLOWED_CHARS.fullmatch(value):
                projected[key] = value
    return projected


def merge(projected: dict[str, str | None], config: dict[str, str], existing: dict[str, str]) -> dict[str, str]:
    """Keep tags the config doesn't own; an owned key missing from `projected` keeps its value."""
    merged = {k: v for k, v in existing.items() if k not in config}
    for key in config:
        if key not in projected:
            if key in existing:
                merged[key] = existing[key]
        elif projected[key] is not None:
            merged[key] = projected[key]
    return merged


def is_newest_revision(bucket: str, handle: str, top_hash: str) -> bool:
    """Skip revisions superseded by a newer timestamp pointer; `latest` is written after the event fires."""
    prefix = f'{NAMED_PACKAGES_PREFIX}{handle}/'
    pointers = [
        obj['Key']
        for page in s3.get_paginator('list_objects_v2').paginate(Bucket=bucket, Prefix=prefix)
        for obj in page.get('Contents', [])
        if POINTER_RE.fullmatch(obj['Key'][len(prefix) :])
    ]
    if not pointers:
        return True
    newest = max(pointers)
    return s3.get_object(Bucket=bucket, Key=newest)['Body'].read().decode() == top_hash


def read_manifest(bucket: str, top_hash: str) -> tuple[dict, list[str]]:
    # ponytail: reads the whole manifest into memory; stream it for multi-GB manifests.
    lines = iter(s3.get_object(Bucket=bucket, Key=f'{MANIFESTS_PREFIX}{top_hash}')['Body'].read().splitlines())
    header = json.loads(next(lines))
    entries = (json.loads(line) for line in lines if line)
    # Directory metadata records carry no physical_keys.
    physical_keys = [e['physical_keys'][0] for e in entries if e.get('physical_keys')]
    return header.get('user_meta') or {}, physical_keys


def parse_physical_key(url: str) -> tuple[str, str, str | None]:
    parsed = urllib.parse.urlparse(url)
    version = urllib.parse.parse_qs(parsed.query).get('versionId', [None])[0]
    return parsed.netloc, urllib.parse.unquote(parsed.path[1:]), version


def tag_object(bucket: str, key: str, version: str | None, config, projected) -> str:
    version_args = {'VersionId': version} if version else {}
    existing = {t['Key']: t['Value'] for t in s3.get_object_tagging(Bucket=bucket, Key=key, **version_args)['TagSet']}
    tags = merge(projected, config, existing)
    if tags == existing:
        return 'unchanged'
    if len(tags) > MAX_TAGS:
        return 'too-many-tags'
    s3.put_object_tagging(
        Bucket=bucket,
        Key=key,
        Tagging={'TagSet': [{'Key': k, 'Value': v} for k, v in tags.items()]},
        **version_args,
    )
    return 'tagged'


def project_revision(bucket: str, handle: str, top_hash: str) -> dict[str, int]:
    config = load_config(bucket)
    if config is None or not is_newest_revision(bucket, handle, top_hash):
        return {}
    user_meta, physical_keys = read_manifest(bucket, top_hash)
    projected = project(config, user_meta)
    counts: dict[str, int] = {}

    def one(url):
        obj_bucket, key, version = parse_physical_key(url)
        # Objects elsewhere may belong to other packages or accounts.
        if obj_bucket != bucket:
            return 'other-bucket'
        try:
            return tag_object(obj_bucket, key, version, config, projected)
        except botocore.exceptions.ClientError as e:
            return e.response['Error']['Code']

    with concurrent.futures.ThreadPoolExecutor(TAGGING_CONCURRENCY) as pool:
        for outcome in pool.map(one, physical_keys):
            counts[outcome] = counts.get(outcome, 0) + 1
    return counts


def handler(event, context):
    # ponytail: one revision per message, whole manifest in one invocation; fan out per
    # chunk of entries when packages outgrow the lambda timeout.
    # Writes are idempotent, so a failed message is retried whole and dead-lettered alone.
    failed = []
    for record in event['Records']:
        try:
            detail = json.loads(record['body'])['detail']
            outcome = project_revision(detail['bucket'], detail['handle'], detail['topHash'])
            print(json.dumps({'revision': detail, 'outcome': outcome}))
            if set(outcome) - FINAL_OUTCOMES:
                failed.append(record['messageId'])
        except Exception:
            logger.exception('failed to process message %s', record['messageId'])
            failed.append(record['messageId'])
    return {'batchItemFailures': [{'itemIdentifier': i} for i in failed]}
