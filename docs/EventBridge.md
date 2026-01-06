<!-- markdownlint-disable -->
# EventBridge Integration: Resolving S3 Event Conflicts

When using Quilt alongside other AWS services that consume S3 events (like FSx, Lambda triggers, or custom applications), you may encounter conflicts because **S3 only allows one event notification configuration per bucket**. This guide shows you how to resolve these conflicts using AWS EventBridge.

## 🎯 Understanding the Problem

### How Quilt Uses S3 Events

By default, Quilt automatically creates S3 Event Notifications to:
- Keep its managed Elasticsearch index up-to-date
- Track changes to bucket contents in real-time
- Maintain package metadata and search functionality

**Default Quilt Event Flow:**
```
S3 Bucket → S3 Event Notification → SNS Topic → SQS Queue → Lambda → Elasticsearch
```

**EventBridge Alternative Flow:**
```
S3 Bucket → EventBridge → SNS Topic → SQS Queue → Lambda → Elasticsearch
```

### The S3 Event Limitation

**AWS S3 Limitation**: Each S3 bucket can only have **one event notification configuration**. This means:

❌ **This Won't Work:**
```
S3 Bucket ──┬── Quilt Event Notification
            └── FSx Event Notification     ← CONFLICT!
```

✅ **This Will Work:**
```
S3 Bucket → EventBridge → ┬── Quilt SNS Topic
                          └── FSx Event Handler
```

## 🛠️ Solution Options

### Option 1: SNS Fanout (Recommended)
Use SNS to distribute events to multiple consumers:
- **Best for**: Multiple AWS services needing S3 events
- **Complexity**: Medium
- **Reliability**: High
- **Guide**: [AWS Fanout Pattern](https://aws.amazon.com/blogs/compute/fanout-s3-event-notifications-to-multiple-endpoints/)

### Option 2: EventBridge Routing (This Guide)
Use EventBridge to create synthetic S3 events:
- **Best for**: Complex event routing and transformation
- **Complexity**: Medium-High  
- **Reliability**: High
- **Flexibility**: Highest

### Option 3: Just-in-Time Resources
Spin up resources only when needed:
- **Best for**: Batch processing workloads
- **Complexity**: Low
- **Cost**: Lowest
- **Limitation**: Not suitable for real-time use cases

## 🚀 EventBridge Implementation Guide

This section provides a complete step-by-step guide to set up EventBridge routing for S3 events to resolve conflicts between Quilt and other services.

### Prerequisites

Before starting, ensure you have:
- ✅ AWS CLI or Console access with appropriate permissions
- ✅ A Quilt deployment already running
- ✅ The S3 bucket you want to add to Quilt

### Step-by-Step Implementation

#### Step 1: Create SNS Topic

Create an SNS topic in the **same region** as your S3 bucket:

<!-- pytest-codeblocks:skip -->
```bash
# Using AWS CLI
aws sns create-topic \
    --name quilt-eventbridge-notifications \
    --region us-east-1

# Note the TopicArn from the response
```

**Console Steps:**
1. Navigate to **SNS Console** → **Topics** → **Create topic**
2. **Type**: Standard
3. **Name**: `quilt-eventbridge-notifications`
4. **Region**: Same as your S3 bucket
5. Click **Create topic** and note the ARN

**Important - SNS Subscription Configuration:**

After creating the SNS topic and subscribing it to Quilt's SQS queues, you need to configure raw message delivery settings:

1. Go to **SNS Console** → **Topics** → **Your topic** → **Subscriptions**
2. For each SQS subscription:
   - **S3SNSToEventBridgeQueue**: Enable "Raw message delivery" ✅
   - **QuiltStack-PkgEventsQueue**: Keep "Raw message delivery" disabled ❌
   - **QuiltStack-IndexerQueue**: Keep "Raw message delivery" disabled ❌

Raw message delivery must be enabled for the EventBridge-specific queue but disabled for Quilt's standard queues to ensure proper message format.

#### Step 2: Enable EventBridge on S3 Bucket

Before EventBridge can receive S3 events, you must enable EventBridge notifications on your S3 bucket:

**Using AWS CLI:**
<!-- pytest-codeblocks:skip -->
```bash
aws s3api put-bucket-notification-configuration \
    --bucket your-bucket-name \
    --notification-configuration '{"EventBridgeConfiguration": {}}'
```

**Using AWS Console:**
1. Navigate to **S3 Console** → Your bucket → **Properties**
2. Scroll to **Amazon EventBridge** section
3. Click **Edit** next to "Amazon EventBridge"
4. Select **On** for "Send notifications to Amazon EventBridge for all events in this bucket"
5. Click **Save changes**

**⚠️ Important**: Enabling EventBridge on the S3 bucket is compatible with existing S3 event notifications. You can have both:
- EventBridge enabled (sends ALL events to EventBridge)
- S3 Event Notifications configured (for other services like FSx)

However, you cannot have two separate S3 Event Notification configurations on the same bucket.

#### Step 3: Create EventBridge Rule

Create an EventBridge rule to capture S3 events:

**Console Steps:**
1. Navigate to **EventBridge Console** → **Rules** → **Create rule**
2. **Name**: `quilt-s3-events-rule`
3. **Event bus**: default
4. **Rule type**: Rule with an event pattern

#### Step 4: Configure Event Pattern

Set up the event pattern to capture S3 operations using native S3 events:

**Event source**: AWS services
**AWS service**: Simple Storage Service (S3)
**Event type**: Amazon S3 Event Notification

**Select these event types:**
- ✅ **Object Created** - Captures PutObject, CopyObject, CompleteMultipartUpload
- ✅ **Object Deleted** - Captures DeleteObject operations

**Bucket specification:**
- Select **Specific bucket(s) by name**
- Enter your bucket name: `your-bucket-name`

**Example Event Pattern JSON:**
```json
{
  "source": ["aws.s3"],
  "detail-type": ["Object Created", "Object Deleted"],
  "detail": {
    "bucket": {
      "name": ["your-bucket-name"]
    }
  }
}
```

**Note**: Unlike the legacy CloudTrail approach, native S3 events in EventBridge are simpler, faster, and don't require CloudTrail to be enabled.

![Event Pattern Configuration](./imgs/event-pattern.png)

#### Step 5: Configure Event Target

Set the SNS topic as the target for EventBridge events:

1. **Target type**: AWS service
2. **Select a target**: SNS topic
3. **Topic**: Select the SNS topic created in Step 1

![Event Target Configuration](./imgs/event-target.png)

#### Step 6: Set Up Input Transformer

Configure the input transformer to convert EventBridge events to S3 event format:

**Input Path:**
```json
{
  "awsRegion": "$.region",
  "bucket": "$.detail.bucket.name",
  "eventName": "$.detail-type",
  "eventTime": "$.time",
  "key": "$.detail.object.key"
}
```

**Input Template:**
```json
{
  "Records": [
    {
      "eventSource": "aws:s3",
      "awsRegion": "<awsRegion>",
      "eventName": "<eventName>",
      "eventTime": "<eventTime>",
      "s3": {
        "bucket": { "name": "<bucket>" },
        "object": { "key": "<key>" }
      }
    }
  ]
}
```

**Note**: This transformer maps native S3 EventBridge events to the standard S3 event notification format that Quilt expects. The `eventName` field will contain the EventBridge detail-type (e.g., "Object Created", "Object Deleted"), which Quilt can process alongside standard S3 event names.

#### Step 7: Configure IAM Permissions

If your SNS topic uses server-side encryption with KMS (which is recommended), you need to grant EventBridge permission to use the KMS key.

**Option 1: Update KMS Key Policy (Recommended)**

Add this statement to your KMS key policy:

```json
{
  "Sid": "Allow EventBridge to use the key",
  "Effect": "Allow",
  "Principal": {
    "Service": "events.amazonaws.com"
  },
  "Action": [
    "kms:Decrypt",
    "kms:GenerateDataKey"
  ],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "kms:ViaService": "sns.us-east-1.amazonaws.com"
    }
  }
}
```

**Option 2: Update EventBridge Execution Role**

EventBridge uses a service-linked role, but for SNS targets with encryption, ensure the role has proper permissions (this is usually handled automatically when you create the rule through the console).

To verify permissions:
1. Go to **EventBridge Console** → **Rules** → Your rule
2. Check the **Targets** section for any permission warnings
3. AWS will automatically request permission to publish to your SNS topic when you create the rule

#### Step 8: Save and Test the Rule

1. Click **Create rule** to save the EventBridge configuration
2. Test by uploading a file to your S3 bucket
3. Check CloudWatch Logs for the EventBridge rule to verify events are being processed

#### Step 9: Configure Quilt

Add the bucket to Quilt using the SNS topic:

1. Open **Quilt Admin Panel** → **Buckets**
2. Click **Add Bucket** or edit existing bucket
3. **Bucket Name**: `your-bucket-name`
4. **SNS Topic ARN**: Paste the ARN from Step 1
5. **Important**: Leave S3 Event Notifications **disabled**

![Quilt EventBridge Configuration](./imgs/quilt-eventbridge.png)

#### Step 10: Initial Indexing

Perform initial bucket indexing:

1. In Quilt Admin Panel, find your bucket
2. Click **Re-Index and Repair**
3. **⚠️ IMPORTANT**: Do **NOT** check the "Repair" checkbox
   - Repair would attempt to create S3 event notifications
   - This would conflict with your existing service (FSx, etc.)
4. Click **Start Re-Index**

### 🧪 Testing Your Setup

#### Step 11: Comprehensive Verification

Verify the complete event flow end-to-end:

**1. Verify S3 EventBridge is enabled:**
<!-- pytest-codeblocks:skip -->
```bash
aws s3api get-bucket-notification-configuration --bucket your-bucket-name
# Should show: {"EventBridgeConfiguration": {}}
```

**2. Test with a small file upload:**
```bash
echo "EventBridge test" > eventbridge-test.txt
aws s3 cp eventbridge-test.txt s3://your-bucket-name/test/
```

**3. Check EventBridge rule metrics (wait 2-3 minutes):**
```bash
# Verify rule is active
aws events describe-rule --name quilt-s3-events-rule

# Check if events are matching
aws cloudwatch get-metric-statistics \
    --namespace AWS/Events \
    --metric-name TriggeredRules \
    --dimensions Name=RuleName,Value=quilt-s3-events-rule \
    --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 600 \
    --statistics Sum
```

**4. Check SNS delivery metrics:**
```bash
aws cloudwatch get-metric-statistics \
    --namespace AWS/SNS \
    --metric-name NumberOfMessagesPublished \
    --dimensions Name=TopicName,Value=quilt-eventbridge-notifications \
    --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 600 \
    --statistics Sum
```

**5. Validate Quilt Integration:**
1. Wait 1-2 minutes for processing
2. Check Quilt catalog to see if the test file appears
3. Search for the file in Quilt's search interface
4. Verify file metadata is correctly indexed

**6. Clean up test file:**
```bash
aws s3 rm s3://your-bucket-name/test/eventbridge-test.txt
# This should also trigger a delete event
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Issue 1: Events Not Appearing in Quilt

**Symptoms:**
- Files uploaded to S3 don't appear in Quilt catalog
- Search doesn't find recently uploaded files

**Troubleshooting Steps:**
1. **Check EventBridge Rule Status**
   <!-- pytest-codeblocks:skip -->
```bash
aws events describe-rule --name quilt-s3-events-rule
```
   - Ensure `State` is `ENABLED`

2. **Check SNS Topic Metrics**
   - Go to SNS Console → Your topic → Monitoring
   - Look for "Messages published" metrics

3. **Validate Input Transformer**
   - Test the EventBridge rule with a sample event in the AWS Console
   - Check CloudWatch Logs for transformation errors

4. **Verify S3 Events are Reaching EventBridge**
   - Upload a test file to your S3 bucket
   - Go to EventBridge Console → Rules → Your rule → Monitoring
   - Check "Invocations" and "Matches" metrics

#### Issue 2: Permission Errors

**Symptoms:**
- EventBridge rule shows errors in CloudWatch
- SNS topic not receiving messages
- "KMS.DisabledException" or encryption-related errors

**Solution:**
Ensure the IAM role used by EventBridge has proper permissions. The role needs both SNS publish permissions and KMS permissions if your SNS topic uses encryption:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": [
        "arn:aws:sns:region:account:quilt-eventbridge-notifications"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:GenerateDataKey",
        "kms:Decrypt"
      ],
      "Resource": "arn:aws:kms:region:account:key/your-kms-key-id",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "sns.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

**Note**: Replace `region`, `account`, and `your-kms-key-id` with your actual values. The KMS key should be the one used by your Quilt SNS topics. Adjust the `kms:ViaService` region to match your deployment region.

#### Issue 3: Duplicate Events

**Symptoms:**
- Files appear multiple times in Quilt
- Excessive processing in Quilt logs

**Solution:**
- Check for multiple EventBridge rules targeting the same bucket
- Ensure you haven't enabled both S3 Event Notifications AND EventBridge

### Performance Considerations

#### Event Latency
- **EventBridge Latency**: Minimal additional delay vs direct S3 event notifications (typically sub-second)
- **Native S3 Events**: EventBridge now uses native S3 events, eliminating CloudTrail processing delays
- **Batch Processing**: Consider batching for high-volume buckets to optimize processing costs

#### Cost Optimization
<!-- pytest-codeblocks:skip -->
```bash
# Monitor EventBridge usage
aws events describe-rule --name quilt-s3-events-rule --query 'EventPattern'

# Check SNS costs
aws sns get-topic-attributes --topic-arn YOUR_TOPIC_ARN --attribute-names All
```

### Known Limitations

#### EventBridge-Specific Limitations

1. **Bulk Delete Operations**
   - The `DeleteObjects` API (used by AWS Console bulk delete) may generate a single event rather than individual delete events
   - **Workaround**: Use individual delete operations or manual re-indexing
   - **Impact**: Bulk deletes may not be reflected in Quilt immediately

2. **Event Transformation**
   - EventBridge events require transformation to match S3 event notification format
   - The input transformer must be configured correctly for Quilt to process events
   - **Mitigation**: Test thoroughly with your specific use cases

#### General S3 Event Limitations

1. **Lifecycle Policy Deletions**
   - S3 lifecycle deletions are **not** captured by S3 Events or EventBridge
   - **AWS Documentation**: [Supported Event Types](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.title.html)

   > You do not receive event notifications from automatic deletes from lifecycle policies or from failed operations.

   > Amazon S3 Lifecycle actions are performed using internal Amazon S3 endpoints and are not captured by event notifications.

### Best Practices

#### Security
- ✅ Use least-privilege IAM policies
- ✅ Enable SNS topic encryption
- ✅ Monitor EventBridge rule metrics
- ✅ Set up CloudWatch alarms for failed events

#### Reliability  
- ✅ Test event flow end-to-end before production
- ✅ Set up dead letter queues for failed events
- ✅ Monitor CloudWatch metrics for all components
- ✅ Have a rollback plan to direct S3 events if needed

#### Cost Management
- ✅ Monitor EventBridge and SNS costs
- ✅ Consider event filtering to reduce volume
- ✅ Use appropriate SNS delivery retry policies
- ✅ Clean up test resources after implementation

## 📚 Additional Resources

- **[AWS EventBridge Documentation](https://docs.aws.amazon.com/eventbridge/)**
- **[S3 Event Notifications via EventBridge](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html)**
- **[S3 Event Notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/NotificationHowTo.html)**
- **[SNS Fanout Pattern](https://aws.amazon.com/blogs/compute/fanout-s3-event-notifications-to-multiple-endpoints/)**
- **[EventBridge Input Transformation](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-transform-target-input.html)**

---

**Need help?** Contact Quilt support or join our [Slack community](https://quiltusers.slack.com/) for assistance with EventBridge integration.
