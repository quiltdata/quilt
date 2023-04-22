# Quilt3 CLI and environment

## `catalog`
```
usage: quilt3 catalog [-h] [--detailed_help] [--host HOST] [--port PORT]
                      [--no-browser]
                      [navigation_target]

Run Quilt catalog locally

positional arguments:
  navigation_target  Which page in the local catalog to open. Leave blank to
                     go to the catalog landing page, pass in an s3 url (e.g.
                     's3://bucket/myfile.txt') to go to file viewer, or pass
                     in a package name in the form 'BUCKET:USER/PKG' to go to
                     the package viewer.

options:
  -h, --help         show this help message and exit
  --detailed_help    Display detailed information about this command and then
                     exit
  --host HOST        Bind socket to this host
  --port PORT        Bind to a socket with this port
  --no-browser       Don't open catalog in a browser after startup
```

Run the Quilt catalog on your machine. Running `quilt3 catalog` launches a
Python webserver on your local machine that serves a catalog web app and
provides required backend services using temporary AWS credentials.
Temporary credentials are derived from your default AWS credentials
(or active `AWS_PROFILE`) using `boto3.sts.get_session_token`.
For more details about configuring and using AWS credentials in `boto3`,
see the AWS documentation:
https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html

#### Previewing files in S3
The Quilt catalog allows users to preview files in S3 by downloading and
processing/converting them inside the Python webserver running on local machine.
Neither your AWS credentials nor data requested goes through any third-party
cloud services aside of S3.

## `config`
```
usage: quilt3 config [-h] [--set KEY=VALUE [KEY=VALUE ...]] [catalog_url]

Configure Quilt

positional arguments:
  catalog_url           URL of catalog to config with, or empty string to
                        reset the config

options:
  -h, --help            show this help message and exit
  --set KEY=VALUE [KEY=VALUE ...]
                        Set a number of key-value pairs for config_values(do
                        not put spaces before or after the = sign). If a value
                        contains spaces, you should define it with double
                        quotes: foo="this is a sentence". Note that values are
                        always treated as strings.
```
## `config-default-remote-registry`
```
usage: quilt3 config-default-remote-registry [-h] default_remote_registry

Configure default remote registry for Quilt

positional arguments:
  default_remote_registry
                        The default remote registry to use, e.g. s3://quilt-ml

options:
  -h, --help            show this help message and exit
```
## `disable-telemetry`
```
usage: quilt3 disable-telemetry [-h]

Disable anonymous usage metrics

options:
  -h, --help  show this help message and exit
```
## `install`
```
usage: quilt3 install [-h] [--registry REGISTRY] [--top-hash TOP_HASH]
                      [--dest DEST] [--dest-registry DEST_REGISTRY]
                      [--path PATH]
                      name

Install a package

positional arguments:
  name                  Name of package, in the USER/PKG format

options:
  -h, --help            show this help message and exit
  --registry REGISTRY   Registry where package is located, usually s3://MY-
                        BUCKET. Defaults to the default remote registry.
  --top-hash TOP_HASH   Hash of package to install. Defaults to latest.
  --dest DEST           Local path to download files to.
  --dest-registry DEST_REGISTRY
                        Registry to install package to. Defaults to local
                        registry.
  --path PATH           If specified, downloads only PATH or its children.
```
## `list-packages`
```
usage: quilt3 list-packages [-h] registry

List all packages in a registry

positional arguments:
  registry    Registry for packages, e.g. s3://quilt-example

options:
  -h, --help  show this help message and exit
```
## `login`
```
usage: quilt3 login [-h]

Log in to configured Quilt server

options:
  -h, --help  show this help message and exit
```
## `logout`
```
usage: quilt3 logout [-h]

Log out of current Quilt server

options:
  -h, --help  show this help message and exit
```
## `push`
```
usage: quilt3 push --dir DIR [-h] [--registry REGISTRY] [--dest DEST]
                   [--message MESSAGE] [--meta META] [--workflow WORKFLOW]
                   [--force] [--dedupe]
                   name

Pushes the new package to the remote registry

positional arguments:
  name                 Name of package, in the USER/PKG format

required arguments:
  --dir DIR            Directory to add to the new package

optional arguments:
  -h, --help           show this help message and exit
  --registry REGISTRY  Registry where to create the new package. Defaults to
                       the default remote registry.
  --dest DEST          Where to copy the objects in the package
  --message MESSAGE    The commit message for the new package
  --meta META          Sets package-level metadata. Format: A json string with
                       keys in double quotes '{"key": "value"}'
  --workflow WORKFLOW  Workflow ID or empty string to skip workflow
                       validation. If not specified, the default workflow will
                       be used.
  --force              Skip the parent top hash check and create a new
                       revision even if your local state is behind the remote
                       registry.
  --dedupe             Skip the push if the local package hash matches the
                       remote hash.
```
