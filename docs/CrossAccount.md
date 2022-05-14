# Cross-account Access

It is often desirable to run the Quilt control plane (CloudFormation stack)
in a separate account from your data plane (S3 Buckets).

Assume that we have two accounts, *ControlAccount* (containing the Quilt
CloudFormation stack) and *DataAccount* (containing the desired S3 buckets).

## Bucket policies

To ensure that the Quilt stack in the *ControlAccount* can access and administer 
S3 buckets in the *DataAccount*, you can apply a bucket policy similar to the
following to buckets in your *DataAccount*.

> Quilt admins can still control which users do an do not have access to the 
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
                "s3:GetObjectAcl",
                "s3:GetObjectVersion",
                "s3:GetObjectVersionAcl",
                "s3:GetObjectVersionTagging",
                "s3:ListBucket",
                "s3:ListBucketVersions",
                "s3:DeleteObject",
                "s3:DeleteObjectVersion",
                "s3:GetBucketNotification",
                "s3:PutBucketNotification"
            ],
            "Resource": [
                "arn:aws:s3:::bucket-in-data-account",
                "arn:aws:s3:::bucket-in-data-account/*"
            ]
        },
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::CONTROL_ACCOUNT:root"
            },
            "Action": [
                "s3:PutObject"
            ],
            "Resource": [
                "arn:aws:s3:::bucket-in-data-account/*"
            ],
            "Condition": {
                "StringEquals": {
                    "s3:x-amz-acl": "bucket-owner-full-control"
                }
            }
        }
    ]
}
```

<!--TODO 
1. Ensure that :root does not over-permit and still only allows explicitly
added principals in ControlAccount to access
2. Consider adding these permissions:
* GetObjectTagging
-->

## Events

By default, when you add a bucket to the Quilt stack, it looks for a suitable
bucket notification. If none is found, adding the bucket will fail.

See [S3 Events, EventBridge](EventBridge.md) for more.

## CloudTrail

For security, auditing, and user-facing analytics, it is recommended that all
S3 buckets in Quilt enable logging via CloudTrail. For cross-account buckets
you must provide an existing trail to Quilt when you deploy the CloudFormation
template, and you must add the buckets in question to CloudTrail.
