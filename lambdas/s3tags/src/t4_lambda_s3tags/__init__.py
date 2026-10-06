"""Project package metadata onto S3 object tags.

Consumes `com.quiltdata` `package-revision` events (from lambdas/pkgevents) via SQS.
A bucket opts in with `.quilt/s3_tags.yml`: `tags: {<tag key>: <JSON pointer into user_meta>}`.
"""

import concurrent.futures
import json
import re
import urllib.parse

import boto3
import botocore.exceptions
import yaml

CONFIG_KEY = '.quilt/s3_tags.yml'
MANIFESTS_PREFIX = '.quilt/packages/'
NAMED_PACKAGES_PREFIX = '.quilt/named_packages/'
POINTER_RE = re.compile(r'[0-9]{10}')
# S3 object tag limits.
MAX_TAGS = 10
MAX_VALUE_LENGTH = 256
ALLOWED_CHARS = re.compile(r'^[\w .:/=+\-@]*$')
TAGGING_CONCURRENCY = 16

s3 = boto3.client('s3')


def load_config(bucket: str) -> dict[str, str] | None:
    try:
        body = s3.get_object(Bucket=bucket, Key=CONFIG_KEY)['Body'].read()
    except s3.exceptions.NoSuchKey:
        return None
    tags = (yaml.safe_load(body) or {}).get('tags')
    if not isinstance(tags, dict):
        raise ValueError(f'{CONFIG_KEY} in {bucket} has no `tags` map')
    return tags


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
            if len(value) <= MAX_VALUE_LENGTH and ALLOWED_CHARS.match(value):
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
    physical_keys = [json.loads(line)['physical_keys'][0] for line in lines if line]
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
    for record in event['Records']:
        detail = json.loads(record['body'])['detail']
        print(
            json.dumps(
                {
                    'revision': detail,
                    'outcome': project_revision(detail['bucket'], detail['handle'], detail['topHash']),
                }
            )
        )
