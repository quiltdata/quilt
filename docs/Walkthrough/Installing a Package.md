## Searching for packages

As explained in ["Uploading a Package"](Uploading%20a%20Package.md), packages are managed using *registries*. There is a one local registry on your machine, and potentially many remote registries elsewhere "in the world". Use `list_packages` to see the packages available on a registry:


```python
import quilt3

# list local packages
list(quilt3.list_packages())
```




    ['aneesh/cli-push',
     'examples/hurdat',
     'aleksey/hurdat']




```python
# list remote packages
list(quilt3.list_packages("s3://quilt-example"))
```




    ['aleksey/hurdat',
     'examples/hurdat',
     'quilt/altair',
     'quilt/hurdat',
     'quilt/open_fruit',
     'quilt/open_images']



## Installing a package

To make a remote package and all of its data available locally, `install` it.

The examples in this section use the `examples/hurdat` [demo package](https://open.quiltdata.com/b/quilt-example/tree/examples/hurdat/):


```python
quilt3.Package.install(
    "examples/hurdat",
    "s3://quilt-example",
)
```

    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 7049.25entries/s]

    Successfully installed package 'examples/hurdat', tophash=f8d1478 from s3://quilt-example


    


Note that unless this registry is public, you will need to be logged into a user who has read access to this registry in order to install from it:

```python
# only need to run this once
# ie quilt3.config('https://your-catalog-homepage/')
quilt3.config('https://open.quiltdata.com/')

# follow the instructions to finish login
quilt3.login()
```

Data files that you download are written to a folder in your local registry by default. You can specify an alternative destination using dest:


```python
quilt3.Package.install(
    "examples/hurdat", 
    "s3://quilt-example", 
    dest="./"
)
```

    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 9027.77entries/s]
    Copying objects: 100%|██████████| 3.62M/3.62M [00:00<00:00, 303MB/s]

    Successfully installed package 'examples/hurdat', tophash=f8d1478 from s3://quilt-example


    


Finally, you can install a specific version of a package by specifying the corresponding top hash:


```python
quilt3.Package.install(
    "examples/hurdat", 
    "s3://quilt-example", 
    top_hash="058e62c"
)
```

    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 11491.24entries/s]
    Copying objects: 100%|██████████| 35.4k/35.4k [00:02<00:00, 14.3kB/s]

    Successfully installed package 'examples/hurdat', tophash=058e62c from s3://quilt-example


    


## Browsing a package manifest

An alternative to `install` is `browse`. `browse` downloads a package manifest without also downloading the data in the package.


```python
# load a package manifest from a remote registry
p = quilt3.Package.browse("examples/hurdat", "s3://quilt-example")

# load a package manifest from the default remote registry
quilt3.config(default_remote_registry="s3://quilt-example")
p = quilt3.Package.browse("examples/hurdat")
```

    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 7541.00entries/s]
    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 10710.68entries/s]


`browse` is advantageous when you don't want to download everything in a package at once. For example if you just want to look at a package's metadata.

## Importing a package

You can import a local package from within Python:


```python
from quilt3.data.examples import hurdat
```

    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 9637.65entries/s]


This allows you to manage your data and code dependencies all in one place in your Python scripts or Jupyter notebooks.
