# Work with packages

## Read a package
Packages may contain data of any size or type. A given package _instance_--specified
by a hash, tag, or version--is _immutable_ for reproducibility.

### Install a data package from  user `uciml`
```bash
$ quilt install uciml/iris
```

Note that most Quilt commands are available _both on the command line and in Python_.

You can install a package as follows:

```python
import quilt
quilt.install("uciml/iris")
```

### Import the package
```
$ python
>>> from quilt.data.uciml import iris
>>> iris
<PackageNode 'Users/YOU/quilt_packages/uciml/iris'>
raw/
tables/
README
>>> iris.tables.bezdek_iris() # this is a pandas DataFrame
    sepal_length  sepal_width  petal_length  petal_width  label
0  5.1           3.5          1.4           0.2          Iris-setosa
1  4.9           3.0          1.4           0.2          Iris-setosa
2  4.7           3.2          1.3           0.2          Iris-setosa
...
```

Read more about the `uciml/iris` package on its [landing page](https://quiltdata.com/package/uciml/iris), or [browse  packages on Quilt](https://quiltdata.com/search/?q=).

## Edit a package
Start by installing and importing the package you wish to modify:
``` python
import quilt
quilt.install("uciml/wine")
from quilt.data.uciml import wine
```

Alternatively, you can  build an empty package and import it for editing:
```python
import quilt
quilt.build("USER/FOO")
from quilt.data.USER import FOO
```

### Edit dataframe nodes
Use the Pandas API to edit existing dataframes:
``` python
df = wine.tables.wine()
hue = df['Hue']
df['HueNormalized'] = (hue - hue.min())/(hue.max() - hue.min())
```

### Add package nodes
Use the `_set` helper method on the top-level package node to create new groups and data nodes:
``` python
import pandas as pd
df = pd.DataFrame(dict(x=[1, 2, 3]))
# insert a dataframe at wine.mygroup.data()
wine._set(["mygroup", "data"], df) 
# insert a file at wine.mygroup.anothergroup.blob()
wine._set(["mygroup", "anothergroup", "blob"], "localpath/file.txt") #
```

### Delete package nodes
Use `del` to delete attributes:
``` python
del wine.raw.wine
```

### Edit metadata
Use the `_meta` attribute to attach any JSON-serializable dictionary of metadata to a group or a data node:

``` python
wine.mygroup._meta['foo'] = 'bar'
wine.mygroup._meta['created'] = time.time()
```

Data nodes contain a built-in key `_meta['_system']` with information such as the original file path. You may access it, but any modifications to it may be lost.

### Persist changes
At this point, your changes only exist in memory. To persist your
changes, read on to learn about  `build` and `push`.

## Build a package

Building a package creates a local bundle of serialized data. `$ quilt ls`
displays your local packages and their location on disk.

There are three ways to build data packages with Quilt:

1. Implicitly with `quilt build USR/PKG DIRECTORY`. Implicit builds are good for taking quick snapshots of unstructured data like images or text files. Quilt serializes columnar formats formats (xls, csv, tsv, etc.) to data frames; all other files will be copied "as is".

1. Explicitly with `quilt build USR/PKG FILE.YML`. Explicit builds allow fine-grained control over package names, types, and contents.

1. One the fly, in Python

Each of the above methods for building packages is supported in [Python](./api.md) and on the [command line](./api.md).

### Implicit builds

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

### Explicit builds

Explicit builds cue from a YAML file, conventionally called `build.yml`.

```bash
quilt build USR/PKG BUILD.YML
```

`build.yml` specifies the structure and contents of a package.

#### `quilt generate` creates a `build.yml` file

An easy way to create a `build.yml` file is as follows:

```bash
quilt generate DIR
```

The above command creates `build.yml` and `README.md` files that you can modify to your liking. A `README.md` file is highly recommended as it populates your package landing page with documentation. See the API section for more on how README markdown is converted to HTML.

You can read more about the syntax of `build.yml` [here](https://docs.quiltdata.com/buildyml.html).

##### Directory and file naming in `quilt generate`
* Directories and files that start with a numeric character or underscore will be prefixed with the letter `n`. If a name collision results, the build will fail with an error.
* If two files have the same path and root name, but different file extensions (`foo.txt`, `foo.csv`), the extensions will be appended as follows: `foo_txt`, `foo_csv`. If, after appending, there remains a name collision, the build will fail with an error.

### Build on the fly

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

### Valid package names
Package handles take the form `USER_NAME/PACKAGE_NAME`. The package name and all of its children must be valid Python identifiers:
* Start with a letter
* Contain only alphanumerics and underscore

The above criteria ensure that packages can be accessed with Python's dot operator.

## Push a package
Pushing a package stores a built package in a server-side registry. Push a package
to back up changes or share your package with others.

```bash
$ quilt login # requires free account
$ quilt push USR/PKG --public
```

Or, in Python:
```python
# log in to the registry (requires a free account)
quilt.login()
# push it to the registry
quilt.push("USR/PKG", is_public=True)
```

Users on Individual and Business plans can omit ~~is_public=True~~ to create private packages.
