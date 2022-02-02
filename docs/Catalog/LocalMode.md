You can run the Quilt catalog on your machine. Running `quilt3 catalog` launches a
Python webserver on your local machine that serves a catalog web app and
provides required backend services using temporary AWS credentials.
Temporary credentials are derived from your default AWS credentials
(or active `AWS_PROFILE`) using `boto3.sts.get_session_token`.
For more details about configuring and using AWS credentials in `boto3`,
see the [AWS documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html).

The Quilt catalog allows users to preview files in S3 by downloading and
processing/converting them inside the Python webserver running on local machine.
Neither your AWS credentials nor data requested goes through any third-party
cloud services aside of S3.

## Installation

Just add `catalog` extra while installing `quilt3`, e.g.:

```bash
$ pip install quilt3[catalog]
```

## Invocation

See the [CLI API reference](../api-reference/cli.md#catalog) for details.
