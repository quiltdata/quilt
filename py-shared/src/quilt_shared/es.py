import datetime
import functools
import json
import os
import random

from aws_requests_auth.aws_auth import AWSRequestsAuth
import boto3
import botocore
import elasticsearch.helpers


PACKAGE_INDEX_SUFFIX = "_packages"
USER_AGENT_EXTRA = " quilt3-lambdas-es-indexer"
ELASTIC_TIMEOUT = 30


class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle datetime and bytes"""

    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()

        return super().default(obj)


class Batcher:
    json_encode = JSONEncoder(ensure_ascii=False, separators=(",", ":")).encode
    BATCH_INDEXER_BUCKET = os.getenv("BATCH_INDEXER_BUCKET")
    BATCH_MAX_BYTES = int(os.getenv("BATCH_MAX_BYTES", 8_000_000))
    BATCH_MAX_DOCS = int(os.getenv("BATCH_MAX_DOCS", 10_000))

    @staticmethod
    def _make_key():
        return f"{random.randbytes(4).hex()}/object"

    def _reset(self):
        """reset the current batch"""
        self.current_batch: list[bytes] = []
        self.current_batch_size = 0

    def __init__(self, s3client, logger) -> None:
        self.s3_client = s3client
        self.logger = logger
        self._reset()

    def _send_batch(self):
        """send the current batch to S3"""
        if not self.current_batch:
            return
        batch = self.current_batch
        self._reset()
        key = self._make_key()
        self.s3_client.put_object(
            Bucket=self.BATCH_INDEXER_BUCKET,
            Key=key,
            Body=b"\n".join(batch),
            ContentType="application/json",
        )
        self.logger.debug("Batch sent to s3://%s/%s", self.BATCH_INDEXER_BUCKET, key)

    def append(self, doc: dict):
        # get doc ownership
        doc["_type"] = "_doc"  # ES 6.x compatibility
        data = "\n".join(map(self.json_encode, filter(None.__ne__, elasticsearch.helpers.expand_action(doc)))).encode()
        assert (
            len(data) < self.BATCH_MAX_BYTES
        ), f"Document size {len(data)} exceeds max batch size {self.BATCH_MAX_BYTES}"

        if (
            len(self.current_batch) >= self.BATCH_MAX_DOCS
            or self.current_batch_size + len(data) > self.BATCH_MAX_BYTES
        ):
            self._send_batch()

        self.current_batch.append(data)
        self.current_batch_size += len(data)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        """Send the remaining batch on exit"""
        self._send_batch()


def make_s3_client():
    """make a client with a custom user agent string so that we can
    filter the present lambda's requests to S3 from object analytics"""
    configuration = botocore.config.Config(user_agent_extra=USER_AGENT_EXTRA)
    return boto3.client("s3", config=configuration)


@functools.cache
def make_elastic():
    elastic_host = os.environ["ES_HOST"]
    session = boto3.session.Session()
    credentials = session.get_credentials().get_frozen_credentials()
    awsauth = AWSRequestsAuth(
        # These environment variables are automatically set by Lambda
        aws_access_key=credentials.access_key,
        aws_secret_access_key=credentials.secret_key,
        aws_token=credentials.token,
        aws_host=elastic_host,
        aws_region=session.region_name,
        aws_service="es",
    )

    return elasticsearch.Elasticsearch(
        hosts=[{"host": elastic_host, "port": 443}],
        http_auth=awsauth,
        # Give ES time to respond when under load
        timeout=ELASTIC_TIMEOUT,
        use_ssl=True,
        verify_certs=True,
        connection_class=elasticsearch.RequestsHttpConnection,
    )
