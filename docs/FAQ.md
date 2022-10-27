<!-- markdownlint-disable -->
## How do I sync my notebook and all of its data and models to S3 as a package?
<!--pytest.mark.skip-->
```python
p = quilt3.Package()
p.set_dir(".", ".")
p.push("USR/PKG", message="MSG", registry="s3://BUCKET")
```
> Use a [.quiltignore file](https://docs.quiltdata.com/advanced-usage/.quiltignore)
for more control over which files `set_dir()` includes.

## How does Quilt versioning relate to S3 object versioning?
Quilt packages are one level of abstraction above S3 object versions.
Object versions track mutations to a single file,
whereas a quilt package references a *collection* files and assigns this collection a unique version.

It is strongly recommended that you enable object versioning on the S3 buckets
that you push Quilt packages to.
Object versioning ensures that mutations to every object are tracked,
and provides some protection against deletion.

## Where are the Quilt 2 packages?
Visit [legacy.quiltdata.com](https://legacy.quiltdata.com/)
and use [`quilt`](https://pypi.org/project/quilt/) on PyPI.

## Does `quilt3` collect anonymous usage statistics?
Yes, to find bugs and prioritize features.

You can disable anonymous usage collection with an environment variable:
```bash
export QUILT_DISABLE_USAGE_METRICS=true
```

Or call `quilt3.disable_telemetry()`
to persistently disable anonymous usage statistics.

## Can I turn off TQDM progress bars for log files?

Yes:
```bash
export QUILT_MINIMIZE_STDOUT=true
```

## Which version of Quilt are you on?

### Python client
```bash
quilt3 --version
```

### CloudFormation application
1. Go to CloudFormation > Stacks > YourQuiltStack > Outputs
1. Copy the row labeled TemplateBuildMetadata
1. "git_revision" is your template version

## Hashing takes a long time. Can I speed it up?

Yes. Follow these steps:

1. Run your compute in the same region as your S3 bucket (as opposed to
a local machine or foreign region)—I/O is much faster.

1. Use a larger instance with more vCPUs.

1. Increase [`QUILT_TRANSFER_MAX_CONCURRENCY`](api-reference/cli.md#quilt_transfer_max_concurrency)
above its default to match your available vCPUs.

## Does Quilt work with R?

In the scientific computing community, the [R Project](https://www.r-project.org/)
is commonly used as an alternative, or companion, to Python. It is a language and
environment for statistical computing and graphics, and is available as Free Software
under the [GNU General Public License](https://www.r-project.org/COPYING).

Currently there are no plans to release a Quilt package for distribution through
the [CRAN package repository](https://cloud.r-project.org/). However, you can still
use Quilt with R, using either:

1. The Command Line Interface (CLI) API
1. [Reticulate](https://rstudio.github.io/reticulate/)

### Using the Quilt CLI API with R
You can script the Quilt CLI directly from your shell environment and chain it
with your R scripts to create a unified workflow:

<!--pytest.mark.skip-->
```bash
quilt3 install my-package # download Quilt data package 
[Run R commands or scripts] # modify the data in Quilt data package using R
quilt3 push --dir path/to/remote-registry my-package # upload Quilt data package to the remote registry
```

### Using Quilt with Reticulate
The [Reticulate](https://rstudio.github.io/reticulate/) package provides a set of tools
for interoperability between Python and R by embedding a Python session within your R session.

## How do I delete a data package and all of the objects in the data package?

You may have a test data package that you wish to delete at some point to ensure
your data repository is clean and organized. *Please do this very carefully!* 
In favor of immutability, Quilt makes deletion a
bit tricky. First, note that `quilt3.Package.delete` only deletes the
_package manifest_, not the *underlying objects*. If you wish to delete
the entire package *and* its objects, _delete the objects first_.

*Warning: the objects you delete will be lost forever. Ditto for the package revision.*

To delete, first browse the package then walk it, deleting its entry objects as follows:

<!--pytest.mark.skip-->
```python
import boto3
import quilt3 as q3

s3 = boto3.client("s3")

reg = "s3://quilt-bio-staging"
pname = "akarve/delete-object"
p = q3.Package.browse(pname, registry=reg)

for (k, e) in p.walk():
    pk = e.physical_key
    s3.delete_object(Bucket=pk.bucket, Key=pk.path, VersionId=pk.version_id)
```

You can then follow the above with `q3.Package.delete(pname, registry=reg, top_hash=p.top_hash)`.

## How complex can my Athena queries be?

Amazon Athena supports a subset of Data Defintion Language (DDL)
and Data Manipulation Language (DML) statements, functions, operators,
and data types, based on [Presto](https://prestodb.io/) and [Trino](https://trino.io/).

This allows for extremely granular querying of your data package name, metadata, and contents
and includes logical operators, comparison functions, conditional expressions, mathematical functions,
bitwise functions, date and time functions and operators, regular expression functions, and aggregate
functions. Please review the references linked below to learn more.

### Helpful examples

`regexp_extract_all(string, pattern)`
  Return the substring(s) matched by the regular expression `pattern` in `string`

<!--pytest.mark.skip-->
```sql
SELECT regexp_extract_all('1a 2b 14m', '\d+');
```

### Considerations and limitations

There are [many considerations and limitations](https://docs.aws.amazon.com/athena/latest/ug/other-notable-limitations.html)
when writing Amazon Athena queries.

### References
* [SQL reference for Amazon Athena](https://docs.aws.amazon.com/athena/latest/ug/ddl-sql-reference.html)
* [Functions in Amazon Athena](https://docs.aws.amazon.com/athena/latest/ug/presto-functions.html)

