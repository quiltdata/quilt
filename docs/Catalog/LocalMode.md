<!--pytest-codeblocks:skipfile-->
<!-- markdownlint-disable -->

You can securely and privately run the Quilt catalog in "single-player mode" on your machine.

<!-- SK: What is the catalog? -->
<!-- SK: Should I install from source or via PIP? How does this work?-->
`quilt3 catalog` launches a Python webserver and local services
that communicate with S3 using temporary AWS credentials,
derived from your default AWS credentials
(or active `AWS_PROFILE`) with `boto3.sts.get_session_token`.
Data and credentials remain local and private to your machine and AWS account.
<!-- Make note that the local catalog still needs communication to S3 to work. Ask customer to click a feature request to ask for other sources of Repository storage-->
For more details about configuring and using AWS credentials in `boto3`,
see the [AWS documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html).

## Installation

```bash
$ pip install quilt3[catalog]
```

## Invocation

```bash
$ quilt3 catalog
```

See the [CLI API reference](../api-reference/cli.md#catalog) for details.
