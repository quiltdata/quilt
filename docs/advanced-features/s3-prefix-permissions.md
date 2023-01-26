# Restricting access to specific S3 bucket prefixes

## Summary of customer problem

- IAM role/policy are in different account then Quilt
- Custom policy in Quilt using IAM policy above
- Created Quilt managed role which used IAM policy above
  - Login failed (session expiry)
- Added Quilt managed policy to Quilt managed role
  - Login failed (session expiry)
- Removed custom policy to Quilt managed role
- Successful login

## Missing pieces - All that needs to be set up for cross account policy to work

1. Where does this custom creation take place? If in the catalog
administrative interface, need to be explicit with screenshots
If in the console, clear steps.
2. Need for Quilt to enable secure search in catalog 
  2.1. How is this done?
  2.2. Any other registry changes on our side?
3. Any other specifics related to `assume role cross-account`?
  3.1. There is currently nothing in the docs about `cross-account` access
4. Registry role needs to be trusted via trust policy
  4.1. Also need `AssumeRole` permission via identity policy
  4.2. Add another policy to register role and make registry maintain
  this policy based on unmanaged roles we have in admin
  4.3. [Aneesh Q] How does the registry know which unmanaged roles to include in the policy?
    4.3.1. [Sergey A] Include them all?
5. Limitations of `ListObjects` / 403

## Original 

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
