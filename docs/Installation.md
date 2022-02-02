# Installation

Quilt has two user-facing components:

* A Python client
* A web catalog

## Python client

Python 3.6 or higher is required.

```bash
$ pip install quilt3[pyarrow]
```

If you do not need to serialize and deserialize dataframes with Quilt, you can
obtain a smaller install, useful in disk-constrained environments like AWS Lambda,
with `pip install quilt3`.

If you plan to use [Quilt Catalog Local Development Mode](Catalog/LocalMode.md),
add `catalog` extra while installing `quilt3`, e.g.:

```bash
$ pip install quilt3[catalog,pyarrow]
```

If you wish to use AWS resources, such as S3 buckets, you will need valid AWS credentials.
If this is your first time using the AWS CLI, run the following:

```bash
$ pip install awscli
$ aws configure
```

If you are already using the AWS CLI, you may use your existing profile, or [create a new profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-multiple-profiles.html).

### Developer

Install the current Quilt client from `master`:

```bash
$ pip install git+https://github.com/quiltdata/quilt.git#subdirectory=api/python
```

## Web catalog and backend services (on AWS)

See [Enterprise install](technical-reference.md) for installation instructions.
