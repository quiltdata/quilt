"""
Turn native S3 EventBridge events (`aws.s3` / Object Created | Object Deleted) into the
S3 notification records the stack's consumers already parse, and fan each one out to:
the indexer queue (SNS envelope), the package-events queue (raw) and the stack bus
(`com.quiltdata.s3`, the shape `s3_sns_to_eventbridge.make_event` emits).
"""

import collections
import datetime
import json
import os
import time
from urllib.parse import quote_plus

import boto3

INDEXER_QUEUE_URL = os.environ.get("INDEXER_QUEUE_URL")
PKG_EVENTS_QUEUE_URL = os.environ.get("PKG_EVENTS_QUEUE_URL")
BUS_ARN = os.environ.get("BUS_ARN")
STACK_NAME = os.environ.get("STACK_NAME")

CREATED = {
    "PutObject": "ObjectCreated:Put",
    "POST Object": "ObjectCreated:Post",
    "CopyObject": "ObjectCreated:Copy",
    "CompleteMultipartUpload": "ObjectCreated:CompleteMultipartUpload",
}
DELETED = {
    "Delete Marker Created": "ObjectRemoved:DeleteMarkerCreated",
    "Permanently Deleted": "ObjectRemoved:Delete",
}


def event_name(event: dict) -> str | None:
    detail = event["detail"]
    if event["detail-type"] == "Object Created":
        return CREATED.get(detail.get("reason"))
    if event["detail-type"] == "Object Deleted":
        return DELETED.get(detail.get("deletion-type"))
    return None


def to_s3_record(event: dict) -> dict | None:
    name = event_name(event)
    if name is None:
        return None
    detail, obj = event["detail"], event["detail"]["object"]
    partition = event["resources"][0].split(":")[1]
    out = {
        # Native events carry the key raw; S3 notifications encode it, and every
        # consumer either unquote_plus-es it or matches the encoded form with `/` intact.
        "key": quote_plus(obj["key"], safe="/"),
        "sequencer": obj["sequencer"],
    }
    # A permanent delete carries neither size nor etag; a delete marker has no size.
    for src, dst in (("size", "size"), ("etag", "eTag"), ("version-id", "versionId")):
        if src in obj:
            out[dst] = obj[src]
    if name == "ObjectRemoved:DeleteMarkerCreated":
        out["isDeleteMarker"] = "true"
    return {
        "eventVersion": "2.1",
        "eventSource": "aws:s3",
        "awsRegion": event["region"],
        "eventTime": event["time"],
        "eventName": name,
        "s3": {
            "bucket": {
                "name": detail["bucket"]["name"],
                "arn": f"arn:{partition}:s3:::{detail['bucket']['name']}",
            },
            "object": out,
        },
    }


def bus_entry(record: dict) -> dict:
    return {
        "Source": "com.quiltdata.s3",
        "DetailType": record["eventName"],
        "Resources": [record["s3"]["bucket"]["arn"]],
        "Detail": json.dumps(record),
        "EventBusName": BUS_ARN,
        "Time": datetime.datetime.fromisoformat(record["eventTime"]),
    }


def emf_line(bucket: str, count: int) -> str:
    return json.dumps(
        {
            "_aws": {
                "Timestamp": int(time.time() * 1000),
                "CloudWatchMetrics": [
                    {
                        "Namespace": "Quilt/EventBridgeWiring",
                        "Dimensions": [["Stack", "Bucket"]],
                        "Metrics": [{"Name": "EventsReceived", "Unit": "Count"}],
                    }
                ],
            },
            "Stack": STACK_NAME,
            "Bucket": bucket,
            "EventsReceived": count,
        }
    )


def handler(event, context):
    sqs, eb = boto3.client("sqs"), boto3.client("events")
    failures = []
    # Counted only once forwarded, so a retried message is not counted twice.
    received = collections.Counter()
    # ponytail: one SendMessage/PutEvents per record; batch them if volume makes the
    # call count matter. Delivery is at-least-once per destination either way.
    for msg in event["Records"]:
        try:
            record = to_s3_record(json.loads(msg["body"]))
            if record is None:
                continue
            body = json.dumps({"Records": [record]})
            sqs.send_message(
                QueueUrl=INDEXER_QUEUE_URL,
                MessageBody=json.dumps({"Type": "Notification", "Message": body}),
            )
            sqs.send_message(QueueUrl=PKG_EVENTS_QUEUE_URL, MessageBody=body)
            resp = eb.put_events(Entries=[bus_entry(record)])
            if resp.get("FailedEntryCount"):
                raise RuntimeError(resp["Entries"])
        except Exception as exc:
            print(json.dumps({"error": repr(exc), "messageId": msg["messageId"]}))
            failures.append({"itemIdentifier": msg["messageId"]})
        else:
            received[record["s3"]["bucket"]["name"]] += 1
    for bucket, count in received.items():
        print(emf_line(bucket, count))
    return {"batchItemFailures": failures}
