<!-- markdownlint-disable -->
## Catalog Overview stats (objects, packages) seem incorrect or aren't updating
## Catalog Packages tab doesn't work
## Catalog packages or stats are missing or are not updating

If you recently added the bucket or upgraded the stack, if search volume is high,
or if the bucket is under rapid modification, wait a few minutes and try again.

### Re-index the bucket

1. Open the bucket in the Quilt catalog

1. Click the gear icon (upper right), or navigate to Users and buckets > Buckets
and open the bucket in question
    ![](imgs/admin-bucket.png)

1. Under "Indexing and notifications", click "Re-index and Repair". Optional:
if and only if bucket notifications were deleted or are not working,
check "Repair S3 notifications".

1. Wait a few minutes while bucket statistics and packages repopulate

### Diagnose issues with ElasticSearch

1. Go to CloudFormation > Stacks > YourQuiltStack > Resources
1. Search for "domain"
1. Click on the link for "Search" under "Physical ID"
1. You are now under ElasticSearch > Dashboards
1. Set the time range to include the period before and after when you noticed
any issues
1. Screenshot the dashboard stats for your domain
1. Click into your domain and then navigate to "Cluster health"
1. Screenshot Summary, Overall Health, and Key Performance Indicator sections
1. Send screenshots to [Quilt support](mailto:support@quiltdata.io).
1. It is not recommended that you adjust ElasticSearch via Edit domain, as these
changes will be lost the next time that you update Quilt

## Missing metadata when working with Quilt packages via the API

> `Package.set_dir()` on the package root (".") overrides package-level metadata.
> If you do not provide `set_dir(".", foo, meta=baz)` with a value for `meta=`,
> `set_dir` will set package-level metadata to `None`.

A common pattern is to `Package.browse()` to get the most recent
version of a package, and then `Package.push()` updates.
You can preserve package-level metadata when calling `set_dir(".", ...)`
as follows:

<!--pytest.mark.skip-->
```python
import quilt3

p = quilt3.Package.browse(
    "user-packages/geodata", 
    registry="s3://bucket_1"
)

p.set_dir(
    ".",
    "s3://bucket_2/path/to/new/geofiles",
    meta=p.meta
)

# Push changes to the S3 registry
p.push(
    "user-packages/geodata",
    registry="s3://bucket_1",
    message="Updating package geodata source data"
)
```

- [Reference](https://docs.quiltdata.com/api-reference/package#package.set_dir).

## "Session expired" notice in the Catalog

There are two reasons for encountering the "Session expired" notice
after clicking the `RELOAD` button in the Quilt Catalog.

1. Your browser cache is out of date, in which case you need to:
    1. Delete session storage
    1. Delete local storage
    1. Delete cookies
1. Your Quilt Role has been corrupted. You will need a Quilt Admin
user to reset your Quilt User Role to a default (**valid**) Role.

If you accidentally broke the Role for your _only_ Quilt Admin user,
then you (or your AWS Cloud Administrator) need to:

1. Log in to your AWS account Console.
1. Go to the CloudFormation service and select your Quilt stack.
1. Click the `Update` button (top-right) to access the "Update stack" page
1. In "Prerequisite - Prepare template" select "Use current template". Click "Next".
1. In the "Specify stack details > Parameters > Administrator web credentials" section:
    1. Change the `AdminUsername` field to a new value **that has never been used before**.
    1. Change the `AdminEmail` field to a new email address **that
    has never been used before**. It may be helpful to use the `+`
    sign in the new email address, followed by any text - it will
    successfully deliver to your inbox. For example, `sarah+admin@...`
    will still be sent to `sarah@...`.
    1. Click "Next".
1. **(Optional & preferred)** In the "Configure stack options > Stack
failure options" section, specify `Roll back all stack resources`.
Click "Next".
1. In the "Review <stack-name> > Change set preview" section, verify
that any changes are not disruptive:
    1. For each resource the "Action" field value will be `Modify`
    and the "Logical ID" field value will be `Migration` for approximately
    four resources.
    1. Click the "Submit" button.

After the deployment update is successfully completed, login to the
Catalog with the new administrator credentials. Create other Admin
users as needed.

### Additional support
To have your stack changeset reviewed by a Quilt support agent, or
if you have further questions, please email
[support@quiltdata.io](mailto:support@quiltdata.io?subject=Quilt
Admin user Role issue) with the subject line "Quilt Admin user Role
issue" and the body containing screenshots of the changeset.
