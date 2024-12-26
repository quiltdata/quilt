<!-- markdownlint-disable -->
# Cross-account access

It is often desirable to run the Quilt control plane (CloudFormation stack)
in a separate account from your data plane (S3 buckets).

Assume that we have two accounts, *ControlAccount* (containing the Quilt
CloudFormation stack) and *DataAccount* (containing the desired S3 buckets).

## Object ownership

If you want *DataAccount* to have access to S3 objects put by *ControlAccount*
(and you probably do), you need to ensure that S3 bucket has `ObjectOwnership`
set to `BucketOwnerEnforced`, see
[docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html)
for details.

## Bucket policies

To ensure that the Quilt stack in the *ControlAccount* can access and administer 
S3 buckets in the *DataAccount*, you can apply a bucket policy similar to the
following to buckets in your *DataAccount*.

> Quilt admins can still control which users do and do not have access to the 
> following bucket via Admin panel Roles and Policies.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::CONTROL_ACCOUNT:root"
            },
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
                "s3:GetBucketNotification",
                "s3:PutBucketNotification"
            ],
            "Resource": [
                "arn:aws:s3:::bucket-in-data-account",
                "arn:aws:s3:::bucket-in-data-account/*"
            ]
        }
    ]
}
```

## Notifications

In order for *ControlAccount* to use an existing and
[correctly configured SNS topic](EventBridge.md#the-workarounds)
for a single bucket in *DataAccount*, add a statement similar to the following
to the topic resource policy:

```json
{
      "Sid": "AWSConfigSNSPolicy",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::CONTROL-ACCOUNT:root"
      },
      "Action": [
        "sns:GetTopicAttributes",
        "sns:Subscribe"
      ],
      "Resource": "SNS_TOPIC_ARN"
}
```

You can now set the SNS topic in the [Catalog Admin Panel](catalog/Admin.md) in bucket
properties under "Indexing and notifications".

## CloudTrail

For security, auditing, and user-facing analytics, it is recommended that all
S3 buckets in Quilt enable logging via CloudTrail. For cross-account buckets
you must provide an existing trail to Quilt when you deploy the CloudFormation
template, and you must add the buckets in question to CloudTrail.
