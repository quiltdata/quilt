# Restricting access to specific S3 bucket prefixes

> Users will still have access to the full list of S3 objects,
packages and logical keys inside of packages.

> No trust relationship work is needed

You can isolate user access to objects stored in specific S3 directories by
defining an array of accessible prefixes in a custom IAM role or Amazon S3
bucket policy.

## Example permissions to limit access

Create a "custom" role or policy with these permissions:

<!-- markdownlint-disable -->
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
<!-- markdownlint-restore -->

## Using the `Condition` element

Alternatively, you can define granular permissions using the
`Condition` element and [IAM policy
string operators](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html):

<!-- markdownlint-disable -->
```json
            ...
            "Resource": [
                "arn:aws:s3:::<BUCKET>",
            ],
            "Condition": {
                "StringLike": {
                    "s3:prefix": ["", ".quilt/*", "<PREFIX>/*"]
                },
                "StringEquals": {
                    "s3:prefix": ["", ".quilt/", "<PREFIX>/"],
                    "s3:delimiter": ["/"]
                }
            },
            ...
```
<!-- markdownlint-restore -->

## Further reading

- [Learn more about how Quilt administers users, roles and
policies](../catalog/Admin.md#users-and-roles)
- [Writing IAM Policies: Grant Access to User-Specific Folders in
an Amazon S3
Bucket](https://aws.amazon.com/blogs/security/writing-iam-policies-grant-access-to-user-specific-folders-in-an-amazon-s3-bucket/)
