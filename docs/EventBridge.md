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
- ✅ CloudTrail enabled for the bucket (Quilt requirement)

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

#### Step 2: Verify CloudTrail Configuration

Quilt requires CloudTrail for S3 data events. Check your CloudFormation stack:

**Option A: Quilt-Managed Trail**
- Go to **CloudFormation** → **Your Quilt Stack** → **Resources**
- Look for a CloudTrail resource
- Quilt will automatically add your bucket to this trail

**Option B: Existing Trail**
- Go to **CloudFormation** → **Your Quilt Stack** → **Parameters**  
- Find the CloudTrail bucket parameter
- Manually add your bucket to the existing trail in CloudTrail console

#### Step 3: Create EventBridge Rule

Create an EventBridge rule to capture S3 events:

**Console Steps:**
1. Navigate to **EventBridge Console** → **Rules** → **Create rule**
2. **Name**: `quilt-s3-events-rule`
3. **Event bus**: default
4. **Rule type**: Rule with an event pattern

#### Step 4: Configure Event Pattern

Set up the event pattern to capture S3 operations:

**Event source**: AWS services
**AWS service**: Simple Storage Service (S3)
**Event type**: Specific operation(s)

**Select these operations:**
- ✅ `PutObject`
- ✅ `CopyObject` 
- ✅ `CompleteMultipartUpload`
- ✅ `DeleteObject`
- ✅ `DeleteObjects`

**Bucket specification:**
- Select **Specific bucket(s) by name**
- Enter your bucket name: `your-bucket-name`

**Example Event Pattern JSON:**
```json
{
  "source": ["aws.s3"],
  "detail-type": ["AWS API Call via CloudTrail"],
  "detail": {
    "eventSource": ["s3.amazonaws.com"],
    "eventName": [
      "PutObject",
      "CopyObject", 
      "CompleteMultipartUpload",
      "DeleteObject",
      "DeleteObjects"
    ],
    "requestParameters": {
      "bucketName": ["your-bucket-name"]
    }
  }
}
```

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
  "awsRegion": "$.detail.awsRegion",
  "bucketName": "$.detail.requestParameters.bucketName", 
  "eventName": "$.detail.eventName",
  "eventTime": "$.detail.eventTime",
  "isDeleteMarker": "$.detail.responseElements.x-amz-delete-marker",
  "key": "$.detail.requestParameters.key",
  "versionId": "$.detail.responseElements.x-amz-version-id"
}
```

**Input Template:**
```json
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

#### Step 7: Save and Test the Rule

1. Click **Create rule** to save the EventBridge configuration
2. Test by uploading a file to your S3 bucket
3. Check CloudWatch Logs for the EventBridge rule to verify events are being processed

#### Step 8: Configure Quilt

Add the bucket to Quilt using the SNS topic:

1. Open **Quilt Admin Panel** → **Buckets**
2. Click **Add Bucket** or edit existing bucket
3. **Bucket Name**: `your-bucket-name`
4. **SNS Topic ARN**: Paste the ARN from Step 1
5. **Important**: Leave S3 Event Notifications **disabled**

![Quilt EventBridge Configuration](./imgs/quilt-eventbridge.png)

#### Step 9: Initial Indexing

Perform initial bucket indexing:

1. In Quilt Admin Panel, find your bucket
2. Click **Re-Index and Repair**
3. **⚠️ IMPORTANT**: Do **NOT** check the "Repair" checkbox
   - Repair would attempt to create S3 event notifications
   - This would conflict with your existing service (FSx, etc.)
4. Click **Start Re-Index**

### 🧪 Testing Your Setup

#### Verify Event Flow

Test that events are flowing correctly:

<!-- pytest-codeblocks:skip -->
```bash
# Upload a test file
aws s3 cp test.txt s3://your-bucket-name/test.txt

# Check EventBridge metrics
aws events describe-rule --name quilt-s3-events-rule

# Check SNS topic metrics  
aws sns get-topic-attributes --topic-arn YOUR_SNS_TOPIC_ARN
```

#### Validate Quilt Integration

1. Upload a file to your S3 bucket
2. Wait 1-2 minutes for processing
3. Check Quilt catalog to see if the file appears
4. Search for the file in Quilt's search interface

## 🔧 Troubleshooting

### Automated Validation Script

A validation script is available to automatically check your EventBridge setup. Contact Quilt support for access to the diagnostic tooling.

### Quick Diagnostic Checklist

Alternatively, manually run this quick diagnostic checklist:

<!-- pytest-codeblocks:skip -->
```bash
# 1. Verify EventBridge rule is ENABLED (not just exists)
aws events describe-rule --name quilt-s3-events-rule --query 'State'
# Expected: "ENABLED"

# 2. Check if rule is triggering
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name TriggeredRules \
  --dimensions Name=RuleName,Value=quilt-s3-events-rule \
  --start-time $(date -u -d '5 minutes ago' '+%Y-%m-%dT%H:%M:%S') \
  --end-time $(date -u '+%Y-%m-%dT%H:%M:%S') \
  --period 300 \
  --statistics Sum

# 3. Verify SNS topic has ALL required queue subscriptions
aws sns list-subscriptions-by-topic --topic-arn YOUR_SNS_TOPIC_ARN --query 'Subscriptions[*].Endpoint'
# Expected: Should include IndexerQueue, PackagerQueue, and S3SNSToEventBridgeQueue
```

### Troubleshooting Flowchart

When events aren't flowing correctly, follow this systematic approach:

```
Event not flowing? Start here:
│
├─ 1. Is EventBridge rule ENABLED?
│   ├─ Check: aws events describe-rule --name <rule> --query 'State'
│   ├─ ❌ DISABLED → Enable it: aws events enable-rule --name <rule>
│   └─ ✅ ENABLED → Continue to step 2
│
├─ 2. Is the rule actually triggering?
│   ├─ Check CloudWatch metrics: TriggeredRules (see command above)
│   ├─ ❌ Not triggering → Check event pattern and CloudTrail
│   └─ ✅ Triggering → Continue to step 3
│
├─ 3. Are ALL queues subscribed to SNS?
│   ├─ Check subscriptions (see command above)
│   ├─ Must include:
│   │   ├─ IndexerQueue (for file indexing)
│   │   ├─ PackagerQueue (for package creation) ⚠️ Often missing!
│   │   └─ S3SNSToEventBridgeQueue (for event routing)
│   ├─ ❌ Missing queues → Add subscriptions in SNS console
│   └─ ✅ All subscribed → Continue to step 4
│
├─ 4. Is Input Transformer configured correctly?
│   ├─ Check EventBridge rule → Targets → Input transformer
│   ├─ ❌ "Matched event" selected → Events in wrong format!
│   ├─ ❌ Missing transformer → Configure per Step 6 above
│   └─ ✅ Transformer configured → Continue to step 5
│
├─ 5. Files indexing but packages NOT appearing?
│   ├─ Symptom: Files show in search, packages don't show in UI
│   ├─ Root cause: PackagerQueue not subscribed to SNS
│   └─ Solution: Add PackagerQueue to SNS topic subscriptions
│
└─ 6. Still not working?
    └─ See detailed troubleshooting sections below
```

### Common Issues and Solutions

#### Issue 1: EventBridge Rule is Disabled

**Symptoms:**
- No events flowing at all
- CloudWatch metrics show zero TriggeredRules
- SNS topic receiving no messages

**Root Cause:**
Someone disabled the EventBridge rule (via Console, CLI, or automation). Rules can be disabled accidentally during troubleshooting or by automation scripts.

**Solution:**
<!-- pytest-codeblocks:skip -->
```bash
# Check rule state
aws events describe-rule --name quilt-s3-events-rule --query 'State'

# If DISABLED, enable it:
aws events enable-rule --name quilt-s3-events-rule --region us-east-1

# Verify it's now enabled
aws events describe-rule --name quilt-s3-events-rule --query 'State'
```

**Prevention:**
- Set up CloudWatch alarm to alert when rule transitions from ENABLED → DISABLED
- Document the rule as critical infrastructure
- Review automation scripts that might disable rules

#### Issue 2: Files Index But Packages Don't Appear in UI

**Symptoms:**
- Files uploaded to S3 appear in Quilt search
- Can browse directly to package URLs
- Packages DON'T appear in the Packages homepage
- EventBridge rule IS firing

**Root Cause:**
The PackagerQueue is not subscribed to the SNS topic. Quilt requires multiple SQS queues to be subscribed:
- **IndexerQueue**: Handles file indexing (this works)
- **PackagerQueue**: Handles package creation events (this is missing)
- **S3SNSToEventBridgeQueue**: Routes events

**Solution:**
<!-- pytest-codeblocks:skip -->
```bash
# 1. List current subscriptions
aws sns list-subscriptions-by-topic --topic-arn YOUR_SNS_TOPIC_ARN

# 2. Find your PackagerQueue ARN
aws sqs list-queues --queue-name-prefix "PackagerQueue"

# 3. Subscribe PackagerQueue to SNS topic
aws sns subscribe \
  --topic-arn YOUR_SNS_TOPIC_ARN \
  --protocol sqs \
  --notification-endpoint YOUR_PACKAGER_QUEUE_ARN

# 4. Update SQS queue policy to allow SNS to send messages
# (Use AWS Console: SQS → Queue → Access Policy)
```

**Verification:**
```bash
# Check that all 3 queues are now subscribed
aws sns list-subscriptions-by-topic --topic-arn YOUR_SNS_TOPIC_ARN \
  --query 'Subscriptions[*].Endpoint'

# Should show:
# - ...IndexerQueue...
# - ...PackagerQueue...  ← Make sure this is present!
# - ...S3SNSToEventBridgeQueue...
```

#### Issue 3: Events in Wrong Format (Missing Input Transformer)

**Symptoms:**
- EventBridge rule fires (metrics show TriggeredRules > 0)
- SNS receives messages
- SQS queues receive messages
- But Quilt doesn't process them correctly

**Root Cause:**
EventBridge rule is configured with "Matched event" instead of using an Input Transformer. This sends events in CloudTrail/EventBridge format, not the S3 notification format that Quilt expects.

**Solution:**
1. Go to EventBridge Console → Rules → `quilt-s3-events-rule`
2. Edit the rule → Targets
3. **Critical**: Configure Input Transformer as shown in Step 6 above
4. Save the rule

**Validation:**
Test the transformation by triggering an event and checking the SQS message format:
```bash
# Upload a test file
aws s3 cp test.txt s3://your-bucket/test.txt

# Wait 30 seconds, then check a message in the queue
aws sqs receive-message \
  --queue-url YOUR_INDEXER_QUEUE_URL \
  --max-number-of-messages 1

# The message should have "Records" array with "s3" object structure
# NOT a CloudTrail "detail" structure
```

#### Issue 4: Events Not Appearing in Quilt

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

2. **Verify CloudTrail is Logging S3 Events**
   - Go to CloudTrail Console → Event history
   - Filter by Event source: `s3.amazonaws.com`
   - Confirm events are being logged

3. **Check SNS Topic Metrics**
   - Go to SNS Console → Your topic → Monitoring
   - Look for "Messages published" metrics

4. **Validate Input Transformer**
   - Test the EventBridge rule with a sample event
   - Check CloudWatch Logs for transformation errors

#### Issue 5: Permission Errors

**Symptoms:**
- EventBridge rule shows errors in CloudWatch
- SNS topic not receiving messages

**Solution:**
Ensure EventBridge has permission to publish to SNS:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "events.amazonaws.com"
      },
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:region:account:quilt-eventbridge-notifications"
    }
  ]
}
```

#### Issue 6: Duplicate Events

**Symptoms:**
- Files appear multiple times in Quilt
- Excessive processing in Quilt logs

**Solution:**
- Check for multiple EventBridge rules targeting the same bucket
- Ensure you haven't enabled both S3 Event Notifications AND EventBridge

### Performance Considerations

#### Event Latency
- **EventBridge Latency**: ~1-5 seconds additional delay vs direct S3 events
- **CloudTrail Dependency**: Events only trigger after CloudTrail processes them
- **Batch Processing**: Consider batching for high-volume buckets

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
   - The `delete-objects` API (used by AWS Console bulk delete) doesn't generate individual `delete-object` events
   - **Workaround**: Use individual delete operations or manual re-indexing
   - **Impact**: Bulk deletes may not be reflected in Quilt immediately

2. **Event Transformation Complexity**
   - EventBridge events have different structure than native S3 events
   - Input transformer may not capture all S3 event metadata
   - **Mitigation**: Test thoroughly with your specific use cases

#### General S3 Event Limitations

1. **Lifecycle Policy Deletions**
   - S3 lifecycle deletions are **not** captured by CloudTrail or S3 Events
   - **AWS Documentation**: [Supported Event Types](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.title.html)
   
   > You do not receive event notifications from automatic deletes from lifecycle policies or from failed operations.

2. **CloudTrail Dependency**
   - EventBridge S3 events require CloudTrail data events
   - **AWS Documentation**: [Lifecycle and Logging](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-and-other-bucket-config.html#lifecycle-general-considerations-logging)
   
   > Amazon S3 Lifecycle actions are not captured by AWS CloudTrail object level logging. CloudTrail captures API requests made to external Amazon S3 endpoints, whereas S3 Lifecycle actions are performed using internal Amazon S3 endpoints.

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
- **[S3 Event Notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/NotificationHowTo.html)**
- **[SNS Fanout Pattern](https://aws.amazon.com/blogs/compute/fanout-s3-event-notifications-to-multiple-endpoints/)**
- **[CloudTrail S3 Data Events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html)**

---

**Need help?** Contact Quilt support or join our [Slack community](https://quiltusers.slack.com/) for assistance with EventBridge integration.
