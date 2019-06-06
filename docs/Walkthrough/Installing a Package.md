## Searching for packages

As explained in ["Uploading a Package"](Uploading%20a%20Package.md), packages are managed using *registries*. There is a one local registry on your machine, and potentially many remote registries elsewhere "in the world". Use `list_packages` to see the packages available on a registry:

```bash
$ python
>>> import quilt3

>>> quilt3.list_packages()  # list local packages

PACKAGE                            TOPHASH        CREATED        SIZE
namespace/packagename:latest       cac145b9c3dc   just now       2.4 GB
othernamespace/packagename:latest  95a134c80z48   14 days ago    2.4 GB

>>> quilt3.list_packages("s3://my-bucket")  # list remote packages

PACKAGE                            TOPHASH        CREATED        SIZE
user1/seattle-weather:latest       cac145b9c3dc   1 hour ago     2.4 GB
user2/new-york-ballgames:latest    95a134c80z48   6 days ago     2.4 GB
```

## Installing a package

To make a remote package and all of its data available locally, `install` it.

```python
import quilt3
p = quilt3.Package.install(
    "username/packagename",
    "s3://your-bucket",
)
```

Note that unless this registry is public, you will need to be logged into a user who has read access to this registry in order to install from it:

```python
import quilt3
quilt3.config('https://your-catalog-homepage/')  # only need to run this once
quilt3.login()  # follow the instructions to finish login
```

Installing a package downloads all of the data and populates an entry for the package in your local registry.

You can omit `registry` if you configure a default remote registry (this will persists between sessions):

```python
quilt3.config(default_remote_registry='s3://your-bucket')

# this now 'just works'
quilt3.Package.install("username/packagename")
```

Data files that you download are written to a folder in your local registry by default. You can specify an alternative destination using `dest`:

```python
quilt3.Package.install("username/packagename", dest="./")
```

Finally, you can install a specific version of a package by specifying the corresponding top hash:

```python
quilt3.Package.install("username/packagename", top_hash="abcd1234")
```

## Browsing a package manifest

An alternative to `install` is `browse`. `browse` downloads a package manifest without also downloading the data in the package.

```python
import quilt3

# load a package manifest from a remote registry
p  = quilt3.Package.browse("username/packagename", "s3://your-bucket")

# load a package manifest from the default remote registry
p  = quilt3.Package.browse("username/packagename")

# load a package manifest from the local registry
p = quilt3.Package.browse("username/packagename", "local")
```

`browse` is advantageous when you don't want to download everything in a package at once. For example if you just want to look at a package's metadata.

## Importing a package

You can import a local package from within Python:

```python
from quilt3.data.username import packagename
```

This allows you to manage your data and code dependencies all in one place in your Python scripts or Jupyter notebooks.
