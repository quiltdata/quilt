# Build a package

Building a package creates a local bundle of serialized data. `$ quilt ls`
displays your local packages and their location on disk.

There are three ways to build data packages with Quilt:

1. Implicitly with `quilt build USR/PKG DIRECTORY`. Implicit builds are good for taking quick snapshots of unstructured data like images or text files. Quilt serializes columnar formats formats (xls, csv, tsv, etc.) to data frames; all other files will be copied "as is".

1. Explicitly with `quilt build USR/PKG FILE.YML`. Explicit builds allow fine-grained control over package names, types, and contents.

1. One the fly, in Python

Each of the above methods for building packages is supported in [Python](./api.md) and on the [command line](./api.md).

## Implicit builds

To implicitly build a package of unserialized data:

```bash
quilt build USR/PKG DIRECTORY
```
Everything in `DIR` and it's subdirectories will be packaged into `USR/PKG`.

To publish your package:
```bash
quilt push USR/PKG --public
```
Users on Individual and Business plans can omit the ~~`--public`~~ flag to create private packages.

## Explicit builds

Explicit builds cue from a YAML file, conventionally called `build.yml`.

```bash
quilt build USR/PKG BUILD.YML
```

`build.yml` specifies the structure and contents of a package.

### `quilt generate` creates a `build.yml` file
An easy way to create a `build.yml` file is as follows:
```bash
quilt generate DIR
```
This command creates `build.yml` and `README.md` files that you can modify to your liking. A `README.md` file is highly recommended as it populates your package landing page with documentation. See the API section for more on how README markdown is converted to HTML.

You can read more about the syntax of `build.yml` [here](https://docs.quiltdata.com/buildyml.html).

#### Directory and file naming in `quilt generate`
* Directories and files that start with a numeric character or underscore will be prefixed with the letter `n`. If a name collision results, the build will fail with an error.
* If two files have the same path and root name, but different file extensions (`foo.txt`, `foo.csv`), the extensions will be appended as follows: `foo_txt`, `foo_csv`. If, after appending, there remains a name collision, the build will fail with an error.

## Build on the fly
```python
# start with an empty package
quilt.build("akarve/foo")
# put some data in it
import pandas as pd
from quilt.data.akarve import foo
df = pd.DataFrame(data=[1,2,3])
foo._set(['bar'], df)
foo.bar()
# Output:
# 0
# 0	1
# 1	2
# 2	3
```

## Notes on valid package names
Package handles take the form `USER_NAME/PACKAGE_NAME`. The package name and the names of any package subtrees must be valid Python identifiers:
* Start with a letter
* Contain only alphanumerics and underscore

The above criteria ensure that packages can be accessed with Python's dot operator.
