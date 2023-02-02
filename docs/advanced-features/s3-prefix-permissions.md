# Restrict Catalog users to S3 bucket prefixes

It is possible to use custom roles and policies in the Quilt Catalog in order
to limit access to specific folders in an S3 bucket. Nevertheless,
this approach has limitations and is therefore not recommended for
high-security data where not just the contents _but the names of files and
folders are sensitive_.


## Pre-requisites

* IAM policies and roles (see below for an example)

* Quilt Catalog Admin status

* For cross-account roles, you must have a recent version of the Quilt
Stack (1-Feb-2023 or later) so that the Quilt registry has sufficient permissions
to assume cross-account roles on behalf or users

* Ask your Quilt Account Manager to **enable "secure search"** for your stack
in order for search to hide the objects from unauthorized users in the search results.


## Limitations and workarounds

* Roles for users of the Quilt Catalog's Bucket tab must have
**full ListBucket permissions**, whether or not they are allowed to access all
folders and objects. Catalog users who click on a prefix or object that they
are not permitted to access will see _Access Denied_.
  * Alternatively, you can [hide the Bucket tab completely](../catalog/Admin.md#show-and-hide-features-in-the-quilt-catalog)
  and leave users to the Package tab.

  > IAM is not designed as a filter for browsing S3.
ListBucket will return a 403 for the root of bucket
if users do not have full permissions (currently incompatible with the Quilt Catalog)

* Similar to prefixes (above), Quilt Packages that reference prefixes that users
cannot access via IAM will reveal package-relative file names and object-level
_Quilt_ metadata, but will not reveal S3 object metadata and will not reveal
object contents.  Clicking on a package entry in the Catalog that has a physical
key that the user is not allowed to access will display _Access Denied_.

* Secure search performs a head request on every object result; this may slow
search performance in the Catalog


## Requirements and recommendations

* After updating your Quilt stack **you must rename, remove, or add a Quilt managed role**
in order to trigger a policy update in the Quilt Stack.

* Manage all Quilt Catalog roles and policies for prefixes [with the Quilt Catalog Admin Panel](../catalog/Admin.md#users-and-roles)

* Provided that you use roles created in the Quilt Catalog Admin Panel
**you do not need to and should not** insert a trust relationship into your
roles by hand.


## Example

You can attach a "custom" policy to a role with the Quilt Catalog Admin Panel
similar to the following:

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

> The `.quilt` folder is where Quilt Package Manifests are stored for all
packages in a bucket registry. Users must have access to this directory
to view Packages.