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

## Missing metadata when working with data packages via the API

> `Package.set_dir()` on the package root (".") overrides package-level metadata.
> If you do not provide `set_dir(".", foo, meta=baz)` with a value for `meta=`,
> `set_dir` will set package-level metadata to `None`.

> This is because _folder-level_ metadata overrides _package-level_ metadata.

A common pattern is to `Package.browse()` to get the most recent
version of a package, and then `Package.push()` updates.
You can preserve package-level metadata when calling `set_dir(".", ...)`
as follows:

<!--pytest.mark.skip-->
```python
import quilt3

p = quilt3.Package()
p.browse(
    name=f"user-packages/{package_name}", 
    registry=f"s3://{bucket}"
)

# Get existing package-level metadata
metadata = p.meta

# Add all files from path to the package and preserve existing metadata
p.set_dir(
    lkey=".",
    path=f"s3://{bucket}/user-packages/{package_name}/",
    meta=metadata
)

# Push changes to the S3 registry
p.push(
    f"user-packages/{package_name}",
    f"s3://{bucket}",
    message=f"Updating package {package_name}"
)
```

- [Reference](https://docs.quiltdata.com/api-reference/package#package.set_dir).
