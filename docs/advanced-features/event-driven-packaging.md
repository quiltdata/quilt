<!-- markdownlint-disable -->
# Event-Driven Packaging (EDP)

## Overview

Data can be added to your Amazon S3 buckets manually by internal
team members and/or external collaborators, or automatically via
instrumentation. No matter how it arrives into your buckets, it 
is helpful, and sometimes critical, to be notified of this data 
migration.

Quilt's *Event-Driven Packaging* service (EDP) monitors S3 object events
for a given Amazon S3 bucket prefix and groups those S3 object
events into logical batches via custom-defined time, space and
prefix heuristics. A `files_ready` event is generated on the receiving
[EventBridge](https://aws.amazon.com/eventbridge/) in order to
notify users and/or other AWS services that this logical batch of
S3 objects are ready to be turned into Quilt packages. *This makes
it easy to ingest data into Quilt data packages from AWS data
migration services* such as [Storage
Gateway](https://aws.amazon.com/storagegateway/) and [Data
Sync](https://aws.amazon.com/datasync/).

> Any AWS service or action that generates S3 object events may trigger the EDP service.

## Requirements

1. A pre-existing VPC that includes a [NAT
Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)
or the following [VPC
endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html#concepts-vpc-endpoints):
  - Amazon S3
  ([gateway](https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html)
  or
  [interface](https://docs.aws.amazon.com/vpc/latest/privatelink/create-interface-endpoint.html))
  - EventBridge (interface)
2. [Enable EventBridge S3
Events](https://docs.aws.amazon.com/AmazonS3/latest/userguide/enable-event-notifications-eventbridge.html)
for all S3 buckets to be monitored by EDP

![](../imgs/edp-event-bridge-s3-properties.png)

## Deployment

To use EDP in your Quilt instance, you will need an additional
CloudFormation template to configure when, and how, events get
generated.

### Parameters

The following parameters need to be defined in the CloudFormation
template during deployment:

- `VPC`: Same as the existing Quilt instance.
- `SecurityGroup`: Same as the existing Quilt instance.
- `Subnets`: Same two subnets as the existing Quilt instance.
- `BucketName`: Name of the Amazon S3 bucket to monitor. Must be
read accessible to EDP.
- `BucketIgnorePrefixes`: List of bucket path segments to ignore
- `BucketPrefixDepth`: The number of `/`-separated path segments
at the beginning of an S3 object key. Default value is `2`.
- `BucketThresholdDuration`: Trigger a notification when this number
of seconds has elapsed since the last object event in the S3 bucket 
occurred. Default value is `300` seconds.
- `BucketThresholdEventCount`: Trigger a notification when this
number of files have been created (since the prior trigger)
- `DBUser`: Username for EDP RDS instance
- `DBPassword`: Password for EDP RDS instance
- `EventBusName`: Name of custom EventBridge event bus that recieves events

![](../imgs/edp-cloudformation-parameters.png)

## How EDP works

1. EDP monitors S3 object events for _s3://source-bucket_
2. After a fixed number of events (`BucketThresholdEventCount`) or
a maximum duration (`BucketThresholdDuration`) EDP creates a
package in _s3://target-bucket_ (the _target_ bucket may or may not be
the same as the _source_ bucket).
3. Each EDP `files_ready` event contains sufficient information for the
recipient to make Quilt data packages from the event:
  - S3 Bucket name
  - Common prefix
  - Number of files
  - Timestamp of event
4. EDP ignores changes to ignored prefixes (`BucketIgnorePrefixes` parameter)
in the source S3 bucket (e.g. `raw/*`)
5. EDP publishes events to an AWS EventBridge bus and can forward
events to external EventBridge buses
6. Users subscribe the Amazon SNS topic created to recieve notifications

## Example EDP events

Currently, EDP generates two different `files_ready` events:
- `package-data-ready`
- `package-ready`

### `package-data-ready`

This event signals that a batch of files is ready to be packaged.
For example with `p.set_dir(".",
f"s3://{e['detail']['bucket']}/{e['detail']['prefix']}")`, followed
by `p.push()`.

```json
{
    "version":"0",
    "id":"4a26374e-72f2-d78f-071b-dac895697670",
    "detail-type":"package-objects-ready",
    "source":"com.quiltdata.edp",
    "account":"XXXXXXXXXXXX",
    "time":"2022-12-08T20:01:34Z",
    "region":"us-east-1",
    "resources":[
        "arn:aws:s3:::source-bucket"
    ],
    "detail":{
        "version":"0.1",
        "bucket":"source-bucket",
        "prefix":"instrument-name/experiment-id/"
    }
}
```

### `package-ready`

This event signals that a Quilt package is available in an Amazon
S3 bucket and that a user-specified interval has elapsed to ensure
that time-driven processes like File Gateway have synchronized their
state to that of the S3 bucket.

```json
{
    "version": "0",
    "id": "13f2c7fd-1ebd-44c8-406c-fad7204a6b26",
    "detail-type": "package-ready",
    "source": "com.quiltdata.edp",
    "account":"XXXXXXXXXXXX",
    "time": "2022-12-12T14:28:27Z",
    "region": "us-east-1",
    "resources": [
      "arn:aws:s3:::bucket-name"
    ],
    "detail": {
      "version": "0.1",
      "package-name": "package/name"
    }
}
```

## Example use case
1. Lab scientist drops files into _s3://RAW/raw/_
2. Lambda function copies filess to _s3://RAW/other/prefix/_
3. EDP listens to _s3://RAW/other/*_ and generates a `package-data-ready`
event
4. Second lambda fuction responds to `package-data-ready` event and
pushes Quilt data package to _s3://PROCESSED_ bucket
5. EDP listens for "package created" (from step above), then emits
a `package_ready` event which is received in a foreign account bus
6. SNS subscription generates email to scientists
7. Lab and Computational scientists recieve email notification
8. Computational scientist opens files backed by _s3://PROCESSED_
bucket

## Features

- EDP is tolerant of container restarts (e.g. events are not consumed
or are requeued so that package revisions are not lost)
- EDP is tolerant of delayed (or partitioned) S3 object events (e.g.
Storage Gateway stops syncing due to network parition)
- EDP supports setting (and retaining) package-level metadata via
specially named files (e.g. "quilt_metadata.json")
- EDP, upon completion and if configured to do so, may warm its
contents to a File Gateway where it has read permissions to ensure
that new EDP-created Quilt packages are available to Gateway clients
like Windows Workspaces.

