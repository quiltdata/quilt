<!-- markdownlint-disable -->
# Event-Driven Packaging (EDP)

> EDP is in private preview. Please contact us for details.

## Overview

Data tend to be created in logical batches by machines, people, and
pipelines. Detecting these logical events from Amazon S3 events alone is
complex and requires extensive custom logic.

Quilt's *Event-Driven Packaging* service (EDP) smartly groups one
or more Amazon S3 object events into a single batch-level event
in [AWS EventBridge](https://aws.amazon.com/eventbridge/) so that
you can easily trigger logical events like package creation that
depend on batches rather than on individual files.

Quilt EDP works with any Amazon service that syncs data to Amazon
S3 and any services that can be targeted from AWS EventBridge (such
as AWS Lambda or AWS Batch).

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
  - EventBridge ([interface endpoint](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-related-service-vpc.html))
2. [Enable EventBridge S3
Events](https://docs.aws.amazon.com/AmazonS3/latest/userguide/enable-event-notifications-eventbridge.html)
for all S3 buckets to be monitored by EDP

![](../imgs/edp-event-bridge-s3-properties.png)

## Deployment

EDP is a standalone CloudFormation template to configure under which
conditions events get generated.

### Parameters

The following parameters need to be defined in the CloudFormation
template during deployment:

- `VPC`: Same as the existing Quilt instance.
- `SecurityGroup`: Same as the existing Quilt instance.
- `Subnets`: Same two subnets as the existing Quilt instance.
- `BucketName`: Name of the Amazon S3 bucket to monitor.
- `BucketIgnorePrefixes`: List of bucket path segments to ignore
- `BucketPrefixDepth`: The number of `/`-separated *common* path segments
at the beginning of an S3 object key. Default value is `2`.
- `BucketThresholdDuration`: Trigger a notification when this number
of seconds has elapsed since the last object event in the S3 bucket 
occurred. Default value is `300` seconds.
- `BucketThresholdEventCount`: Trigger a notification when this
number of files have been created (since the prior trigger)
- `DBUser`: Username for EDP RDS instance
- `DBPassword`: Password for EDP RDS instance
- `EventBusName`: Name of custom EventBridge event bus that receives events

![](../imgs/edp-cloudformation-parameters.png)

## How EDP works

1. EDP monitors S3 object events for _s3://source-bucket_
2. After a fixed number of events (`BucketThresholdEventCount`) or
a maximum duration within a common prefix (`BucketThresholdDuration`) EDP creates a
package in _s3://target-bucket_ (the _target_ bucket may or may not be
the same as the _source_ bucket).
3. Each EDP event contains sufficient information for the
recipient to make Quilt data packages from the event:
  - S3 Bucket name
  - Common prefix
  - Number of files
  - Timestamp of event
4. EDP ignores changes to ignored prefixes (`BucketIgnorePrefixes` parameter)
in the source S3 bucket (e.g. `raw/*`)
5. EDP publishes the events to an AWS EventBridge bus.
6. Event is forwarded to external EventBridge buses and/or a user-defined
Lambda function
7. Users subscribe the Amazon SNS topic created to receive notifications

## `package-objects-ready` Event Type

This event signals that a batch of files is **ready to be packaged**.

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

## `package-ready` Event Type

> This is used internally and most users won't explicitly use this
event type

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
2. Lambda function copies files to _s3://RAW/other/prefix/_
3. EDP listens to _s3://RAW/other/*_ and generates a `package-objects-ready`
event.
4. Second lambda fuction responds to `package-objects-ready` event and
pushes Quilt data package to _s3://PROCESSED_ bucket.
5. EDP listens for "package created" (from step above), then emits
a `package_ready` event which is received in a foreign account bus
6. SNS subscription generates email to scientists.
7. Lab and Computational scientists receive email notification.
8. Computational scientist opens files backed by _s3://PROCESSED_
bucket.

## Handling EDP events via EventBridge rules and Lambda functions

The following example CloudFormation template creates (1) an
EventBridge rule that targets a `package-objects-ready` event,
forwarding it to (2) a Lambda function that processes the event,
printing out `event["detail"]["bucket"]` and `event["detail"]["prefix"]`.

```yaml
Parameters:
  BucketName:
    Type: String
  EDPEventBusName:
    Type: String
Resources:
  LambdaRole:
    Type: "AWS::IAM::Role"
    Properties:
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Sid: ""
            Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: "sts:AssumeRole"
      ManagedPolicyArns:
        - "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  Lambda:
    Type: "AWS::Lambda::Function"
    Properties:
      Code:
        ZipFile: |
          def lambda_handler(event, context):
              print(event["detail"]["bucket"])
              print(event["detail"]["prefix"])
      Handler: index.lambda_handler
      Role: !GetAtt LambdaRole.Arn
      Runtime: python3.9
      Timeout: 10
  EventBridgeRule:
    Type: "AWS::Events::Rule"
    Properties:
      EventBusName: !Ref EDPEventBusName
      EventPattern:
        detail:
          bucket:
            - Ref: BucketName
        detail-type:
          - package-objects-ready
        source:
          - com.quiltdata.edp
      Targets:
        - Arn: !GetAtt Lambda.Arn
          Id: Lambda
  EventBridgeRuleLambdaPermission:
    Type: "AWS::Lambda::Permission"
    Properties:
      Action: "lambda:InvokeFunction"
      FunctionName: !GetAtt Lambda.Arn
      Principal: events.amazonaws.com
      SourceArn: !GetAtt EventBridgeRule.Arn
```

## Features

- EDP, upon completion and if configured to do so, may warm its
contents to a File Gateway where it has read permissions to ensure
that new EDP-created Quilt packages are available to Gateway clients
like Windows Workspaces.

## Debugging

EDP create a CloudWatch dashboard which exposes some metrics useful
for debugging:

- **EDP event bus topic**: Displays the number of events emitted by
EDP. If EDP is working correctly there should be one or more
events received (depending on the time range selected).
- **Per-bucket metrics**:
  - **S3 EventBridge rule**: The number of events published to
  EventBridge from the specified Amazon S3 bucket. If there is no
  data, there are several possibilities:
    - **Invocations**: If this value is zero, the S3 bucket isn't
    correctly configured (`Send notifications to Amazon EventBridge
    for all events in this bucket` is not turned `On`).
    - **TriggeredRules**: If this value is zero, there was a problem
    with the automated EventBridge rule creation process during
    deployment. In general, you want the number of invocations to
    approximately equal the number of triggered rules.
    - **Failed Invocations**: This value should be zero. If greater
    than zero, there is an EDP configuration issue.
  - **Store in DB lambda**: If EDP is configured correctly, there
  should be zero errors and a 100% success rate.
  - **Emit event lambda**: If EDP is configured correctly, there
  should be zero errors and a 100% success rate.

![](../imgs/edp-cloudwatch-dashboard.png)

Additionally, users can subscribe directly to the EDP SNS topic. This is
useful for both debugging and viewing how events are structured.

## Limitations

- Currently, only one Amazon S3 bucket can be monitored at a time.


## Example

### Overview

1. User or instrument adds file(s) to an Amazon S3 bucket
2. EDP sends EventBridge a `package-objects-ready` event
2. A lambda function checks for a value in the metadata against a predefined Quilt workflow
  - If the value exists do nothing
  - If the value is missing, move to a seperate **quarantine** S3 bucket
3. Send a SNS notification

### Setup

1. EDP sends a notification to an Amazon EventBridge
Bus (`quilt-edp`) with the following **Rule** attached:

    ```json
    {
        "detail-type": ["package-objects-ready"],
        "source": ["com.quiltdata.edp"],
        "detail": {
            "bucket": ["quilt-test-bucket"]
        }
    }
    ```

    For this to work, you will need a LambdaRole that can get objects
    from the original S3 bucket and put objects in the target bucket

2. AWS managed `AWSLambdaVPCAccessExecutionRole`: Provides minimum
permissions for a Lambda function to execute while accessing a
resource within a VPC - create, describe, delete network interfaces
and write permissions to CloudWatch Logs.

3. Custom inline role (`root`):

    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Action": [
                    "s3:GetObject",
                    "s3:GetObjectVersion",
                    "s3:ListBucket",
                    "s3:ListBucketVersions",
                    "s3:PutObject"
                ],
                "Resource": [
                    "arn:aws:s3:::quilt-experiment",
                    "arn:aws:s3:::quilt-experiment/*",
                    "arn:aws:s3:::quilt-experiment-quarantine",
                    "arn:aws:s3:::quilt-experiment-quarantine/*"
                ],
                "Effect": "Allow"
            },
            {
                "Action": "sns:Publish",
                "Resource": "arn:aws:sns:<region>:<account>:quilt-experiment-BadMetadataTopic",
                "Effect": "Allow"
            }
        ]
    }
    ```

### Amazon SNS Topic

**Topic Creation**
1. Create a new `Standard` SNS topic (or `FIFO` if strict message
ordering is required)
2. Give the topic an easily identifiable name
3. Encrypt the topic if desired
4. Access policy:
  * Publishers: Only the topic owner
  * Subscribers: On the topic owner
5. Delivery retry policy: Use the default delivery retry policy
unless you have specific requirements
6. Optionally add Tags to search and filter and track costs
7. Click `Create topic`

**(Optional) Topic Subscription**
If your Lambda function requires notification on failure (or success), 
create a new subscription using the desired protocol (Email,
Lambda, etc).

### Lambda Function

Create a new Python 3.9 Lambda function (`MetadataTest`).

**Configuration**
1. General configuration:
  * Description: Optionally add a meaningful description.
  * Memory: 512 MB
  * Ephemeral storage: 512 MB
  * Timeout: 15 min 0 sec
  * SnapStart: None
2. Triggers:
  * Connect to the AWS EventBridge Bus (`quilt-edp`) Rule you created above
  and ensure the Rule state is `ENABLED`
3. Permissions:
  * Automatically obtained from the attached `AWSLambdaVPCAccessExecutionRole`
4. Destinations: N/A
5. Function URL: N/A
6. Environment variables:

  | Key  | Value |
  | ------------- | ------------- |
  | `LOG_LEVEL` | `DEBUG` |
  | `POWERTOOLS_LOGGER_LOG_EVENT` | `1` |
  | `QUARANTINE_BUCKET_NAME` | `quilt-experiment-quarantine` |
  | `QUILT_URL` | `<QUILT-DNS>` |
  | `SNS_TOPIC_ARN` | `<OPTIONAL-SNS-TOPIC-ARN>` |
  | `WORKFLOW_NAME` | `<OPTIONAL-WORKFLOW-NAME>` |

7. Tags: N/A for this example
8. VPC: The `VPC`, `Subnets` and `Security groups` associated with your environment.
9. Monitoring:
  * Logs and metrics (default): `Enabled`
10. Concurrency: N/A
11. Asynchronous invocation: Defaults are good
12. Code signing: N/A
13. Database proxies: N/A
14. File systems: N/A
15. State machines: N/A

**Python Script**

> Add [AWS Lambda Powertools for
Python](https://awslabs.github.io/aws-lambda-powertools-python) to your `Layers` 
for best practice adoption.

The script below assumes a deployment package or Lambda layer that
includes the libraries used.

<!--pytest.mark.skip-->
```python
import datetime
import functools
import io
import operator
import os
import pathlib
import tempfile

import boto3
import botocore.exceptions
import openpyxl as openpyxl
import quilt3 as quilt3
from aws_lambda_powertools import Logger

logger = Logger()
s3 = boto3.client("s3")
sns = boto3.client("sns")

WORKFLOW_NAME = os.environ.get("WORKFLOW_NAME") or ...
QUARANTINE_BUCKET_NAME = os.environ["QUARANTINE_BUCKET_NAME"]
SNS_TOPIC_ARN = os.environ["SNS_TOPIC_ARN"]
MAX_SNS_SUBJECT_LEN = 99
QUILT_URL = os.environ["QUILT_URL"]

# Quilt beautify file strings
QUILT_SUMMARIZE_JSON_STR = '["' + META_OBJ_NAME + '"]'

QUILT_README_STR = f"""# Mass spec data package\n\n
Created on {datetime.date.today()} by an 
automated Lambda agent for the {WORKFLOW_NAME} workflow."""

QUILT_IGNORE_STR = """.DS_*
Icon
._*
.TemporaryItems
.Trashes
.VolumeIcon.icns
"""

# Define beautify files
beautify_files = {
    "quilt_summarize.json": QUILT_SUMMARIZE_JSON_STR,
    "README.md": QUILT_README_STR,
    ".quiltignore": QUILT_IGNORE_STR,
}


@logger.inject_lambda_context
def lambda_handler(event, context):
    bucket = event["detail"]["bucket"]
    prefix = event["detail"]["prefix"]

    try:
        s3.head_object(Bucket=bucket, Key=prefix + META_OBJ_NAME)
    except botocore.exceptions.ClientError as e:
        if e.response["Error"]["Code"] == "404":
            logger.debug(f"There is no {META_OBJ_NAME} at {prefix}")
            return
        raise

    pkg = quilt3.Package().set_dir(".", f"s3://{bucket}/{prefix}")
    if META_OBJ_NAME not in pkg:
        logger.debug(f"There is no {META_OBJ_NAME} in a package")
        return

    wb = openpyxl.load_workbook(io.BytesIO(pkg[META_OBJ_NAME].get_bytes()))
    sheet = wb[wb.sheetnames[0]]
    meta = dict(
        map(operator.itemgetter(slice(0, 2)), sheet.iter_rows(values_only=True))
    )
    # Ensure meta is JSON serializable.
    meta = {
        k: v.isoformat() if isinstance(v, (datetime.date, datetime.time)) else v
        for k, v in meta.items()
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = pathlib.Path(tmpdir)
        for name, body in beautify_files.items():
            if name in pkg:
                logger.debug(f"File {name} already exists. Ignoring.")
                continue
            logger.debug(f"File {name} does not exist at {prefix}. Creating.")
            file_path = tmpdir_path / name
            file_path.write_text(body)
            pkg.set(name, file_path)

        pkg.set_meta(meta)
        pkg_name = prefix.strip("/")
        push = functools.partial(
            pkg.push,
            pkg_name,
            registry=f"s3://{bucket}",
            force=True,
            message="Created by EDP",
            workflow=WORKFLOW_NAME,
        )
        try:
            push(dedupe=True)
        except quilt3.workflows.WorkflowValidationError as e:
            logger.warning("Workflow check failed")
            file_path = tmpdir_path / "README.md"
            file_path.write_text(str(e))
            pkg.set("README.md", file_path)
            push(registry=f"s3://{QUARANTINE_BUCKET_NAME}", workflow=...)
            subject = f"failed validation for package {pkg_name}"
            if len(subject) > MAX_SNS_SUBJECT_LEN:
                subject = subject[: MAX_SNS_SUBJECT_LEN - 1] + "…"
            message = (
                f"Validation failed for workflow {WORKFLOW_NAME} while pushing "
                f"package with name {pkg_name} to {bucket}. It was pushed to "
                f"{QUARANTINE_BUCKET_NAME} instead.\n"
                f"{QUILT_URL}/b/{QUARANTINE_BUCKET_NAME}/packages/{pkg_name}\n\n"
                f"Error message is:\n{e}\n"
            )
            sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Message=message,
                Subject=subject,
            )

