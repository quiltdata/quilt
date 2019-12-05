
# quilt3 CLI
Quilt CLI

## `quilt3 catalog`
Run the Quilt catalog on your machine (**requires Docker**). Running `quilt3 catalog` launches a webserver on your local machine using Docker and a Python microservice that supplies temporary AWS credentials to the catalog. Temporary credentials are derived from your default AWS credentials (or active `AWS_PROFILE`) using `boto3.sts.get_session_token`. For more details about configuring and using AWS credentials in `boto3`, see: [AWS credentials for boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html)

### Previewing files in S3
The Quilt catalog allows users to preview files in S3 without downloading. It relys on a API Gateway and AWS Lambda to generate certain previews in the cloud. The catalog launched by `quilt3 catalog` sends preview requests to the [https://open.quiltdata.com](https://open.quiltdata.com). Preview requests contain short-lived signed URLs generated using your AWS credentials. It is **not recommended to use `quilt3 catalog` to browse highly sensitive files.** We strongly encourage users with highly sensitive information in S3 to run a private Quilt deployment. See [quiltdata.com](https://quiltdata.com) for more information.


