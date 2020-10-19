# CLI, environment

## `catalog`

```text
usage: quilt3 catalog [-h] [--detailed_help] [navigation_target]

Run Quilt catalog locally

positional arguments:
  navigation_target  Which page in the local catalog to open. Leave blank to
                     go to the catalog landing page, pass in an s3 url (e.g.
                     's3://bucket/myfile.txt') to go to file viewer, or pass
                     in a package name in the form 'BUCKET:USER/PKG' to go to
                     the package viewer.

optional arguments:
  -h, --help         show this help message and exit
  --detailed_help    Display detailed information about this command and then
                     exit
```

Run the Quilt catalog on your machine \(requires Docker\). Running `quilt3 catalog` launches a webserver on your local machine using Docker and a Python microservice that supplies temporary AWS credentials to the catalog. Temporary credentials are derived from your default AWS credentials \(or active `AWS_PROFILE`\) using `boto3.sts.get_session_token`. For more details about configuring and using AWS credentials in `boto3`, see the AWS documentation: [https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html)

#### Previewing files in S3

The Quilt catalog allows users to preview files in S3 without downloading. It relies on a API Gateway and AWS Lambda to generate certain previews in the cloud. The catalog launched by `quilt3 catalog` sends preview requests to [https://open.quiltdata.com](https://open.quiltdata.com). Preview requests contain short-lived signed URLs generated using your AWS credentials. Data is encrypted in transit and no data is retained by Quilt. Nevertheless, it is recommended that you use `quilt3 catalog` only for public data. We strongly encourage users with sensitive data in S3 to run a private Quilt deployment. Visit [https://quiltdata.com](https://quiltdata.com) for more information.

## `install`

```text
usage: quilt3 install [-h] [--registry REGISTRY] [--top-hash TOP_HASH]
                      [--dest DEST] [--dest-registry DEST_REGISTRY]
                      [--path PATH]
                      name

Install a package

positional arguments:
  name                  Name of package, in the USER/PKG[/PATH] format
                        ([/PATH] is deprecated, use --path parameter instead)

optional arguments:
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

## `verify`

```text
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
  --extra-files-ok     Whether extra files in the directory should cause a
                       failure
```

## `login`

```text
usage: quilt3 login [-h]

Log in to configured Quilt server

optional arguments:
  -h, --help  show this help message and exit
```

## `logout`

```text
usage: quilt3 logout [-h]

Log out of current Quilt server

optional arguments:
  -h, --help  show this help message and exit
```

## `config`

```text
usage: quilt3 config [-h] [--set KEY=VALUE [KEY=VALUE ...]] [catalog_url]

Configure Quilt

positional arguments:
  catalog_url           URL of catalog to config with, or empty string to
                        reset the config

optional arguments:
  -h, --help            show this help message and exit
  --set KEY=VALUE [KEY=VALUE ...]
                        Set a number of key-value pairs for config_values(do
                        not put spaces before or after the = sign). If a value
                        contains spaces, you should define it with double
                        quotes: foo="this is a sentence". Note that values are
                        always treated as strings.
```

## `disable-telemetry`

```text
usage: quilt3 disable-telemetry [-h]

Disable anonymous usage metrics

optional arguments:
  -h, --help  show this help message and exit
```

## `list-packages`

```text
usage: quilt3 list-packages [-h] registry

List all packages in a registry

positional arguments:
  registry    Registry for packages, e.g. s3://quilt-example

optional arguments:
  -h, --help  show this help message and exit
```

## `push`

```text
usage: quilt3 push --dir DIR [-h] [--registry REGISTRY] [--dest DEST]
                   [--message MESSAGE] [--meta META]
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
```

## `config-default-remote-registry`

```text
usage: quilt3 config-default-remote-registry [-h] default_remote_registry

Configure default remote registry for Quilt

positional arguments:
  default_remote_registry
                        The default remote registry to use, e.g. s3://quilt-ml

optional arguments:
  -h, --help            show this help message and exit
```

## Environment variables

### `QUILT_DISABLE_USAGE_METRICS`

Disable anonymous usage collection. Defaults to `False`

```text
$ export QUILT_DISABLE_USAGE_METRICS=true
```

### `QUILT_MINIMIZE_STDOUT`

Turn off TQDM progress bars for log files. Defaults to `False`

```text
$ export QUILT_MINIMIZE_STDOUT=true
```

### `XDG_*`

Quilt uses appdirs for Python to determine where to write data. You can therefore override the following path constants with environment variables using the XDG standard \(see [appdirs docs](https://pypi.org/project/appdirs/)\).

For instance, AWS Lambda requires the user to use `tmp/*` as the scratch directory. You can override `quilt3.util.CACHE_PATH`, so that `quilt3 install` will succeed in Lambda, by setting the `XDG_CACHE_HOME` environment variable.

## Constants \(see [util.py](https://github.com/quiltdata/quilt/blob/master/api/python/quilt3/util.py) for more\)

* `APP_NAME`
* `APP_AUTHOR`
* `BASE_DIR` - Base directory of the application
* `BASE_PATH` - Base pathlib path for the application directory
* `CACHE_PATH` - Pathlib path for the user cache directory
* `TEMPFILE_DIR_PATH` - Base pathlib path for the application `tempfiles`
* `CONFIG_PATH` - Base pathlib path for the application configuration file
* `OPEN_DATA_URL` - Application data url
* `PACKAGE_NAME_FORMAT` - Regex for legal package names

