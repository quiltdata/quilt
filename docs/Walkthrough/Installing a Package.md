## Searching for packages

As explained in ["Uploading a Package"](Uploading%20a%20Package.md), packages are managed using *registries*. There is a one local registry on your machine, and potentially many remote registries elsewhere "in the world". Use `list_packages` to see the packages available on a registry:


```python
import quilt3
quilt3.list_packages()  # list local packages
```

```bash
PACKAGE                            TOPHASH        CREATED        SIZE
namespace/packagename:latest       cac145b9c3dc   just now       2.4 GB
othernamespace/packagename:latest  95a134c80z48   14 days ago    2.4 GB
```


```python
quilt3.list_packages("s3://quilt-example")
```

```bash
PACKAGE                            TOPHASH        CREATED        SIZE
user1/seattle-weather:latest       cac145b9c3dc   1 hour ago     2.4 GB
user2/new-york-ballgames:latest    95a134c80z48   6 days ago     2.4 GB
```

## Installing a package

To make a remote package and all of its data available locally, `install` it.

The examples in this section use the `examples/hurdat` [demo package](https://open.quiltdata.com/b/quilt-example/tree/examples/hurdat/):


```python
quilt3.Package.install(
    "examples/hurdat",
    "s3://quilt-example",
)
```

Note that unless this registry is public, you will need to be logged into a user who has read access to this registry in order to install from it:


```python
# only need to run this once
# ie quilt3.config('https://your-catalog-homepage/')
quilt3.config('https://open.quiltdata.com/')

# follow the instructions to finish login
quilt3.login()
```

Data files that you download are written to a folder in your local registry by default. You can specify an alternative destination using `dest`:


```python
quilt3.Package.install(
    "examples/hurdat", 
    "s3://quilt-example", 
    dest="./"
)
```

Finally, you can install a specific version of a package by specifying the corresponding top hash:


```python
quilt3.Package.install(
    "examples/hurdat", 
    "s3://quilt-example", 
    top_hash="058e62c"
)
```

## Browsing a package manifest

An alternative to `install` is `browse`. `browse` downloads a package manifest without also downloading the data in the package.


```python
# load a package manifest from a remote registry
p = quilt3.Package.browse("examples/hurdat", "s3://quilt-example")

# load a package manifest from the default remote registry
quilt3.config(default_remote_registry="s3://quilt-example")
p = quilt3.Package.browse("examples/hurdat")
```

`browse` is advantageous when you don't want to download everything in a package at once. For example if you just want to look at a package's metadata.

## Importing a package

You can import a local package from within Python:


```python
from quilt3.data.examples import hurdat
```

This allows you to manage your data and code dependencies all in one place in your Python scripts or Jupyter notebooks.
