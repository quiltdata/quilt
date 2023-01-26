# Restricting access to specific prefixes in a S3 bucket

> Users will still have access to the full list of S3 objects,
packages and logical keys inside of packages.

You can isolate user access to objects stored in specific S3 directories by
defining an array of accessible prefixes in a custom IAM role or Amazon S3
bucket policy.

Create "custom" role or policy with these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:GetObjectTagging",
                "s3:GetObjectVersion",
                "s3:GetObjectVersionTagging",
                "s3:ListBucket",
                "s3:ListBucketVersions",
                "s3:DeleteObject",
                "s3:DeleteObjectVersion",
                "s3:PutObject",
                "s3:PutObjectTagging"
            ],
            "Resource": [
                "arn:aws:s3:::<BUCKET>",
                "arn:aws:s3:::<BUCKET>/.quilt/*",
                "arn:aws:s3:::<BUCKET>/<PREFIX>/*"
            ]
        }
    ]
}
```

> Content of some objects may still be exposed through search results.
Such behavior could be prevented by enabling a special feature flag, though
enabling it may slow down search.
Ask your Quilt manager to enable it for you.
