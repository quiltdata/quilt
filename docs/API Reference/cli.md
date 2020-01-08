# Quilt3 CLI

## `catalog`
```
usage: quilt3 catalog [-h] [--detailed_help] [s3_url]

Run Quilt catalog locally

positional arguments:
  s3_url           S3 URL to browse in local catalog

optional arguments:
  -h, --help       show this help message and exit
  --detailed_help  Display detailed information about this command and then
                   exit
```

Run the Quilt catalog on your machine (requires Docker). Running
`quilt3 catalog` launches a webserver on your local machine using
Docker and a Python microservice that supplies temporary AWS
credentials to the catalog. Temporary credentials are derived from
your default AWS credentials (or active `AWS_PROFILE`) using
`boto3.sts.get_session_token`. For more details about configuring and
using AWS credentials in `boto3`, see the AWS documentation: 
https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html

#### Previewing files in S3
The Quilt catalog allows users to preview files in S3 without
downloading. It relies on a API Gateway and AWS Lambda to generate
certain previews in the cloud. The catalog launched by `quilt3
catalog` sends preview requests to https://open.quiltdata.com. Preview
requests contain short-lived signed URLs generated using your AWS
credentials. It is not recommended to use `quilt3 catalog` to browse
highly sensitive files. We strongly encourage users with highly
sensitive information in S3 to run a private Quilt deployment. See
https://quiltdata.com for more information.

## `install`
```
usage: quilt3 install [-h] [--registry REGISTRY] [--top-hash TOP_HASH]
                      [--dest DEST] [--dest-registry DEST_REGISTRY]
                      name

Install a package

positional arguments:
  name                  Name of package, in the USER/PKG format

optional arguments:
  -h, --help            show this help message and exit
  --registry REGISTRY   Registry where package is located, usually s3://MY-
                        BUCKET. Defaults to the default remote registry.
  --top-hash TOP_HASH   Hash of package to install. Defaults to latest.
  --dest DEST           Local path to download files to.
  --dest-registry DEST_REGISTRY
                        Registry to install package to. Defaults to local
                        registry.
```
## `verify`
```
usage: quilt3 verify [-h] --registry REGISTRY --top-hash TOP_HASH --dir DIR
                     [--extra-files-ok]
                     name

Verify that package contents matches a given directory

positional arguments:
  name                 Name of package, in the USER/PKG format

optional arguments:
  -h, --help           show this help message and exit
  --registry REGISTRY  Registry where package is located, usually s3://MY-
                       BUCKET
  --top-hash TOP_HASH  Hash of package to verify
  --dir DIR            Directory to verify
  --extra-files-ok     Directory to verify
```
## `login`
```
usage: quilt3 login [-h]

Log in to configured Quilt server

optional arguments:
  -h, --help  show this help message and exit
```
## `logout`
```
usage: quilt3 logout [-h]

Log out of current Quilt server

optional arguments:
  -h, --help  show this help message and exit
```
## `config`
```
usage: quilt3 config [-h] [catalog_url]

Configure Quilt

positional arguments:
  catalog_url  URL of catalog to config with, or empty string to reset the
               config

optional arguments:
  -h, --help   show this help message and exit
```
