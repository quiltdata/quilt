# Using Quilt with other services that consume S3 events

By default, when you connect a bucket to Quilt, Quilt will create an S3
"Event Notification" that forwards events to SNS (and ultimately to SQS and Lambda)
so that Quilt can keep its managed ElasticSearch up-to-date regarding changes
to the underlying bucket.

## The conflict 
As of this writing S3 does not permit overlapping S3 event notifications.
As such, services such as FSx and Quilt may clash.

## The workarounds

1. Provide Quilt with an SNS topic that receives ObjectRemoved:* and ObjectCreated:*
from S3
1. Use EventBridge to generate synthetic S3 events
1. Avoid using S3 notifications by spinning resources (e.g. FSx clusters) up 
"just in time" to avoid the need for live notification from S3

## EventBridge workaround

Suppose you wish to add the bucket `X` to Quilt and use `X` with FSx "always on".
FSx will consume the S3 event notifications. So you can use EventBridge to send
similar notifications to Quilt, thus circumventing the need for Quilt to rely 
directly on S3 event notifications.

You may of course script the following steps. See

1. Create an SNS topic in the same region as `X` 
1. Add `X` to a CloudTrail
1. Create an EventBridge Rule in the same region as `X`
1. Create an Event Pattern using Pre-defined pattern by service > AWS > S3
1. Set Event type to "Specific operation(s)" and select the following:
   * PutObject
   * CopyObject
   * CompleteMultipartUpload
   * DeleteObject
   * DeleteObjects
1. Select "Specific bucket(s) by name" and specify `X`
    ![](./imgs/event-pattern.png)
1. Now we specify the event Target. You will target the SNS topic
that you created above.
    ![](./imgs/event-target.png)
1. Specify the Input transformer as follows:
    #### Input Path
    ```
    {
        "awsRegion": "$.detail.awsRegion",
        "bucketName": "$.detail.requestParameters.bucketName",
        "eventName": "$.detail.eventName",
        "eventTime": "$.detail.eventTime",
        "isDeleteMarker": "$.detail.responseElements.x-amz-delete-marker",
        "key": "$.detail.requestParameters.key",
        "versionId": "$.detail.requestParameters.x-amz-version-id"
    }
    ```
    #### Input Template
    ```
    {
        "Records": [
            {
                "awsRegion": <awsRegion>,
                "eventName": <eventName>,
                "eventTime": <eventTime>,
                "s3": {
                    "bucket": {
                        "name": <bucketName>
                    },
                    "object": {
                        "eTag": "",
                        "isDeleteMarker": <isDeleteMarker>,
                        "key": <key>,
                        "versionId": <versionId>
                    }
                }
            }
        ]
    }
    ```
1. Save the Rule.
1. In the Quilt Admin Panel, under Buckets, add `X` and/or set the SNS Topic
ARN under "Indexing and notifications". 
    ![](./imgs/quilt-eventbridge.png)

Now Quilt will receive events directly from EventBridge and does not require
native S3 event notifications of any kind.