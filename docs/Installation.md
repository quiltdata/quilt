# Installation

Quilt has two user-facing components:

* A Python client
* A web catalog

## Python client

Python 3.6 or higher is required.

```bash
$ pip install quilt
```

If you wish to use AWS resources, such as S3 buckets, you will need valid AWS credentials. If this is your first time using the AWS CLI, run the following:

```bash
$ pip install aws-cli
$ aws configure
```

If you are already using the AWS CLI, you may use your existing profile, or [create a new profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-multiple-profiles.html).

### Developer

Install the current Quilt client from `master`:

```bash
$ pip install git+https://github.com/quiltdata/quilt.git#subdirectory=api/python
```

## Web catalog and backend services (on AWS)

See [Technical Reference](./Technical%20Reference.md) for installation instructions.
