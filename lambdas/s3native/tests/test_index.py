import json
import pathlib
from unittest.mock import MagicMock
from urllib.parse import unquote_plus

import pytest

import t4_lambda_s3native as n

EVENTS = json.loads((pathlib.Path(__file__).parent / "probe_events.json").read_text())


def by(reason=None, deletion=None, key=None):
    for e in EVENTS:
        d = e["detail"]
        if (reason is None or d.get("reason") == reason) and (
            deletion is None or d.get("deletion-type") == deletion
        ) and (key is None or d["object"]["key"] == key):
            return e
    raise LookupError((reason, deletion, key))


@pytest.mark.parametrize(
    "event, name",
    [
        (by("PutObject", key="plain.txt"), "ObjectCreated:Put"),
        (by("POST Object"), "ObjectCreated:Post"),
        (by("CopyObject"), "ObjectCreated:Copy"),
        (by("CompleteMultipartUpload"), "ObjectCreated:CompleteMultipartUpload"),
        (by(deletion="Delete Marker Created"), "ObjectRemoved:DeleteMarkerCreated"),
        (by(deletion="Permanently Deleted"), "ObjectRemoved:Delete"),
    ],
)
def test_event_names_from_probe(event, name):
    assert n.to_s3_record(event)["eventName"] == name


def test_key_is_encoded_like_s3_notifications_and_round_trips():
    raw = "dir/a b+c%2Fd é.txt"
    rec = n.to_s3_record(by(key=raw))
    assert rec["s3"]["object"]["key"] == "dir/a+b%2Bc%252Fd+%C3%A9.txt"
    assert unquote_plus(rec["s3"]["object"]["key"]) == raw


def test_package_keys_pass_through_unchanged():
    rec = n.to_s3_record(by(key=".quilt/packages/1220abc"))
    assert rec["s3"]["object"]["key"] == ".quilt/packages/1220abc"
    assert rec["eventSource"] == "aws:s3"


def test_permanent_delete_has_no_size_or_etag():
    obj = n.to_s3_record(by(deletion="Permanently Deleted"))["s3"]["object"]
    assert "size" not in obj and "eTag" not in obj and "versionId" in obj


def test_unknown_reason_is_dropped():
    e = json.loads(json.dumps(by("PutObject", key="plain.txt")))
    e["detail"]["reason"] = "SomethingNew"
    assert n.to_s3_record(e) is None


def test_handler_fans_out_and_reports_only_failed_messages(monkeypatch):
    sqs, eb = MagicMock(), MagicMock()
    eb.put_events.side_effect = [{"FailedEntryCount": 0}, {"FailedEntryCount": 1, "Entries": [{}]}]
    monkeypatch.setattr(n.boto3, "client", lambda svc: {"sqs": sqs, "events": eb}[svc])
    msgs = [
        {"messageId": "ok", "body": json.dumps(by("PutObject", key="plain.txt"))},
        {"messageId": "bad", "body": json.dumps(by("CopyObject"))},
        {"messageId": "garbled", "body": "{"},
    ]
    assert n.handler({"Records": msgs}, None) == {
        "batchItemFailures": [{"itemIdentifier": "bad"}, {"itemIdentifier": "garbled"}]
    }
    indexer_body = json.loads(sqs.send_message.call_args_list[0].kwargs["MessageBody"])
    assert json.loads(indexer_body["Message"])["Records"][0]["eventName"] == "ObjectCreated:Put"
    assert sqs.send_message.call_count == 4


def test_handler_emits_one_metric_line_per_bucket_for_forwarded_events(monkeypatch, capsys):
    monkeypatch.setattr(n, "STACK_NAME", "stk")
    eb = MagicMock()
    eb.put_events.side_effect = [{"FailedEntryCount": 0}] * 2 + [{"FailedEntryCount": 1, "Entries": [{}]}]
    monkeypatch.setattr(n.boto3, "client", lambda svc: {"sqs": MagicMock(), "events": eb}[svc])
    other = json.loads(json.dumps(by("CopyObject")))
    other["detail"]["bucket"]["name"] = "other"
    msgs = [
        {"messageId": "a", "body": json.dumps(by("PutObject", key="plain.txt"))},
        {"messageId": "b", "body": json.dumps(by("POST Object"))},
        {"messageId": "c", "body": json.dumps(other)},
    ]
    n.handler({"Records": msgs}, None)
    lines = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    metrics = [line for line in lines if "_aws" in line]
    assert len(metrics) == 1
    (m,) = metrics
    assert (m["Stack"], m["Bucket"], m["EventsReceived"]) == ("stk", by("POST Object")["detail"]["bucket"]["name"], 2)
    (cw,) = m["_aws"]["CloudWatchMetrics"]
    assert cw == {
        "Namespace": "Quilt/EventBridgeWiring",
        "Dimensions": [["Stack", "Bucket"]],
        "Metrics": [{"Name": "EventsReceived", "Unit": "Count"}],
    }
