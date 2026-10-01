<!-- markdownlint-disable -->
# Cross-Account and Cross-Region Buckets

This guide covers adding a bucket to a Quilt stack when the bucket lives in a
different AWS account, a different region, or both, and getting it indexed.

Terms used below:

- **Stack account**: the account and region where the Quilt CloudFormation stack runs.
- **Data account**: the account that owns the S3 bucket.
- `STACK-ACCOUNT-ID`, `DATA-ACCOUNT-ID`, `REGION`, `your-data-bucket`: replace these with your own values.

## How bucket add works

When an admin adds a bucket in **Admin → Buckets**, the Quilt registry adds it
under the stack's own service role, in the stack account. Your users' Quilt
roles are not involved.

The stack's service roles already have identity permissions for any bucket
you register. A bucket in another account also needs **resource policies in
the data account** that let the stack account in:

| Resource in the data account | Needed when |
|---|---|
| Bucket policy | Always |
| SNS topic policy | The bucket already sends notifications to a topic in the data account |
| KMS key policy | The bucket uses SSE-KMS with a customer-managed key |

Cross-account access needs no IAM role assumption and no CloudTrail changes.

## Checklist

Do these in order. Each step is described in detail further down.

1. Decide how Quilt receives S3 events (see the decision table below).
2. In the data account, set Object Ownership to **Bucket owner enforced**.
3. In the data account, apply the bucket policy.
4. If the bucket already publishes to an SNS topic, add the topic policy statement. The topic must be in the **same region as the bucket**.
5. If the bucket uses SSE-KMS, update the key policy.
6. Run the pre-flight checks from the stack account.
7. Add the bucket in **Admin → Buckets**, with the notification mode from step 1.
8. Upload a test file, and confirm it appears in the catalog and in search within a few minutes.

## Choose a notification mode

Quilt keeps search current by subscribing to the bucket's S3 events through
SNS. The Add form offers three modes.

| Your bucket today | Mode to use | What Quilt does | Search stays current? |
|---|---|---|---|
| No event notifications | **Automatic**: leave SNS Topic ARN blank, Skip unchecked | Creates an SNS topic in the stack account, in the bucket's region, and points the bucket's notifications at it | Yes |
| Notifies one SNS topic for `s3:ObjectCreated:*` **and** `s3:ObjectRemoved:*` | **Automatic** | Adopts that topic and subscribes to it. Needs the topic policy | Yes |
| Notifies an SNS topic that you want to keep managing, or uses EventBridge fan-out | **Explicit**: enter that topic's ARN | Only subscribes to the topic. You must route the bucket's events to it yourself | Yes, if your routing sends both event types |
| Notifies an SQS queue or a Lambda directly, or a topic with narrower events | Change the bucket to an SNS fan-out ([S3 Events, EventBridge](EventBridge.md)), then use Explicit | — | — |
| You cannot grant any of the above yet | **Skip S3 notifications (not recommended)** | Adds and indexes the bucket once, then receives no events | **No**: new objects and packages appear only after **Re-index and repair** |

Use Skip only as a temporary measure. A bucket added with Skip shows packages
and files missing from search as soon as new data arrives.

## Step 1: Object Ownership

Objects that Quilt writes into the bucket (for example, package manifests)
should belong to the data account.

<!-- pytest.mark.skip -->
```bash
aws s3api put-bucket-ownership-controls \
    --bucket your-data-bucket \
    --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]' \
    --profile data-account
```

## Step 2: Bucket policy

Apply this policy in the data account. It covers what Quilt's read-write roles
use, plus the notification actions the registry needs.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "QuiltStackAccess",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::STACK-ACCOUNT-ID:root" },
      "Action": [
        "s3:GetObject",
        "s3:GetObjectAttributes",
        "s3:GetObjectTagging",
        "s3:GetObjectVersion",
        "s3:GetObjectVersionAttributes",
        "s3:GetObjectVersionTagging",
        "s3:ListBucket",
        "s3:ListBucketVersions",
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "s3:PutObject",
        "s3:PutObjectTagging",
        "s3:RestoreObject",
        "s3:GetBucketNotification",
        "s3:PutBucketNotification"
      ],
      "Resource": [
        "arn:aws:s3:::your-data-bucket",
        "arn:aws:s3:::your-data-bucket/*"
      ]
    }
  ]
}
```

Notes:

- The `root` principal delegates to the stack account's IAM. Only roles that
  the stack account's own policies allow can use it. Quilt controls which users
  can reach the bucket through its own roles and policies.
- If the bucket is read-only for Quilt, you can drop the `Delete*`, `Put*Object*`
  and `RestoreObject` actions. Package pushes to this bucket will then fail.
- With **Explicit** or **Skip**, `s3:PutBucketNotification` is not used.
  **Automatic** needs both notification actions.
- If you restrict the principal to specific roles instead of `root`, include
  at least the stack's `AmazonECSTaskExecutionRole` (bucket add),
  `SearchHandlerRole` (indexing), `PkgEventsRole`, and the user roles
  (`T4BucketReadRole`, `T4BucketWriteRole`, and any managed roles). Find their
  ARNs under CloudFormation → your stack → Resources.

<!-- pytest.mark.skip -->
```bash
aws s3api put-bucket-policy \
    --bucket your-data-bucket \
    --policy file://bucket-policy.json \
    --profile data-account
```

## Step 3: SNS topic policy (existing topic only)

Skip this step if the bucket has no notifications and you use **Automatic**.

Check what the bucket publishes to today:

<!-- pytest.mark.skip -->
```bash
aws s3api get-bucket-notification-configuration \
    --bucket your-data-bucket --profile data-account
```

If it lists a `TopicArn`, add this statement to that topic's policy. Merge it
with the existing statements; do not replace them.

```json
{
  "Sid": "QuiltStackSubscribe",
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::STACK-ACCOUNT-ID:root" },
  "Action": ["sns:GetTopicAttributes", "sns:Subscribe", "sns:Unsubscribe"],
  "Resource": "arn:aws:sns:REGION:DATA-ACCOUNT-ID:your-topic-name"
}
```

Requirements for the topic:

- **Same region as the bucket.** S3 delivers notifications only to a topic in
  the bucket's region.
- If the topic is encrypted with a customer-managed KMS key, that key's policy
  must allow `s3.amazonaws.com` to `kms:GenerateDataKey*` and `kms:Decrypt`.
  Without it, S3 cannot publish.

A bucket removed from one Quilt stack keeps its notification pointing at that
stack's topic. Adding it to a **different** stack then requires either this
topic policy on the old topic, or removing the old notification first.

## Step 4: SSE-KMS (customer-managed keys only)

Cross-account KMS needs permission on **both** sides.

1. **Key policy** (data account): allow the stack's roles to use the key.

   ```json
   {
     "Sid": "QuiltStackUseKey",
     "Effect": "Allow",
     "Principal": { "AWS": "arn:aws:iam::STACK-ACCOUNT-ID:root" },
     "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
     "Resource": "*"
   }
   ```

2. **Identity policies** (stack account): follow
   [SSE-KMS in the technical reference](technical-reference.md#s3-buckets-with-service-side-encryption-using-key-management-service-sse-kms),
   using the key's full ARN in the data account.

Buckets that use SSE-S3 (the AWS default) need nothing here. Bucket add can
succeed while previews and search content for SSE-KMS objects still fail; if
that happens with a key in another account, contact [Quilt support](mailto:support@quilt.bio).

## Step 5: Pre-flight checks

Run these with credentials for an administrator **in the stack account**.
Each one maps to a step of bucket add.

<!-- pytest.mark.skip -->
```bash
B=your-data-bucket
aws s3api head-bucket --bucket "$B"                       # exists; prints region
aws s3api list-objects-v2 --bucket "$B" --max-keys 1      # s3:ListBucket
aws s3api head-object --bucket "$B" --key <a-key-from-above>   # s3:GetObject
aws s3api get-bucket-notification-configuration --bucket "$B"  # s3:GetBucketNotification
# Only if the output above lists a TopicArn:
aws sns get-topic-attributes --topic-arn <that-TopicArn> --region <bucket-region>
```

An `AccessDenied` from any of these shows which grant is missing.

## Step 6: Add the bucket

1. Go to **Admin → Buckets → Add bucket** and enter the bucket name. The region is detected automatically.
2. Under **Indexing and notifications**, apply the mode you picked:
   - Automatic: SNS Topic ARN blank, Skip unchecked.
   - Explicit: paste the topic ARN.
   - Skip: check **Skip S3 notifications (not recommended)**.
3. Save.

Adding a bucket in a region other than the stack's also creates a
`quilt-scratch-*` bucket in that region, in the stack account. Quilt uses it
for package pushes.

## What each error means

| Error in the Add form | Cause | Fix |
|---|---|---|
| No such bucket | The name is wrong, or the bucket was deleted | Check the name |
| Bucket already added | Already registered on this stack | Edit the existing bucket |
| `AccessDenied … GetBucketNotificationConfiguration` | Bucket policy lacks `s3:GetBucketNotification` | Step 2 |
| `Failed to modify Notification Config on <bucket>: … AccessDenied` | Bucket policy lacks `s3:PutBucketNotification` | Step 2, or use Explicit/Skip |
| Notification configuration error | The bucket already notifies an SQS queue, a Lambda, a topic with only some events, or a topic that no longer exists | See the decision table: fan out through SNS, then use Explicit |
| No such topic, enter a valid SNS topic ARN or leave blank | The ARN, or the region inside it, is wrong | Copy the ARN from the topic's console page |
| `403 - AuthorizationError: …` | The topic policy does not allow the stack account to subscribe | Step 3 |
| Permission denied: ListObjectsV2 (or HeadObject) failed for bucket '…' at … | After ~30 s, the stack still cannot list or read objects | Step 2 |
| Something went wrong | An error with no specific message. One known cause: the bucket already notifies a topic in another account that the stack cannot read | Step 3, or remove the old notification. Otherwise, collect the details below and contact support |

To diagnose **Something went wrong**:

- In the browser's developer tools → Network, select the failed `graphql`
  request and copy its Response body.
- Or check the registry service's CloudWatch logs in the stack account at the
  time of the attempt.

Send either to [Quilt support](mailto:support@quilt.bio).

## After adding: if search looks incomplete

1. **Was Skip used?** Then only objects present at add time were indexed. Use
   **Re-index and repair** (see [Troubleshooting](Catalog/Troubleshooting.md)), or
   switch to a notification mode.
2. **Explicit mode:** confirm the topic receives both `ObjectCreated` and
   `ObjectRemoved` events from the bucket.
3. **SSE-KMS:** confirm Step 4 on both sides.
