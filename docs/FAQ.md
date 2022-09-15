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
