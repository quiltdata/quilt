Data in Quilt is organized in terms of **data packages**. A data package is a logical group of files, directories, and metadata.

## Initializing a package

To edit a new empty package, use the package constructor:


```python
import quilt3
p = quilt3.Package()
```

To edit a preexisting package, use `browse`:


```python
# let's first install a package
quilt3.Package.install(
    "examples/hurdat",
    "s3://quilt-example",
)
# now you can browse the existing package
p = quilt3.Package.browse('examples/hurdat')
```

    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 5801.25entries/s]
    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 9094.33entries/s]

    Successfully installed package 'examples/hurdat', tophash=f8d1478 from s3://quilt-example


    


For more information on accessing existing packages see the section "[Installing a Package](./Installing%20a%20Package.md)".

## Adding data to a package

Use the `set` and `set_dir` commands to add individual files and whole directories, respectively, to a `Package`:



```python
# add entries individually using `set`
# ie p.set("foo.csv", "/local/path/foo.csv"),
# p.set("bar.csv", "s3://bucket/path/bar.csv")

# create test data
with open("data.csv", "w") as f:
    f.write("id, value\na, 42")

p = quilt3.Package()
p = (p
     .set("data.csv", "data.csv")
     .set("banner.png", "s3://quilt-example/imgs/banner.png")
    )

# or grab everything in a directory at once using `set_dir`
# ie p.set_dir("stuff/", "/path/to/stuff/"),
# p.set_dir("things/", "s3://path/to/things/")

# create test directory
import os
os.mkdir("stuff")
p = (p
     .set_dir("stuff/", "./stuff/")
     .set_dir("imgs/", "s3://quilt-example/imgs/")
    )
```

The first parameter to these functions is the *logical key*, which will determine where the file lives within the package. So after running the commands above our package will look like this:


```python
print(p)
```

    (remote Package)
     └─banner.png
     └─data.csv
     └─imgs/
       └─banner.png
     └─stuff/
    


The second parameter is the *physical key*, which states the file's actual location. The physical key may point to either a local file or a remote object (with an `s3://` path).

If the physical key and the logical key are the same, you may omit the second argument:


```python
# assuming data.csv is in the current directory
p = quilt3.Package()
print(p.set("data.csv"))
```

    (local Package)
     └─data.csv
    


Another useful trick. Use `"/"` to set the contents of the package to that of the current directory:


```python
print(p.set_dir("/", "./"))
```

    (local Package)
     └─Editing a Package.ipynb
     └─Editing a Package.md
     └─Getting Data from a Package.ipynb
     └─Getting Data from a Package.md
     └─Installing a Package.ipynb
     └─Installing a Package.md
     └─Uploading a Package.ipynb
     └─Uploading a Package.md
     └─Working with a Bucket.ipynb
     └─Working with a Bucket.md
     └─Working with the Catalog.md
     └─data.csv
    


## Deleting data in a package

Use `delete` to remove entries from a package:


```python
p.delete("data.csv")
```




    (local Package)
     └─Editing a Package.ipynb
     └─Editing a Package.md
     └─Getting Data from a Package.ipynb
     └─Getting Data from a Package.md
     └─Installing a Package.ipynb
     └─Installing a Package.md
     └─Uploading a Package.ipynb
     └─Uploading a Package.md
     └─Working with a Bucket.ipynb
     └─Working with a Bucket.md
     └─Working with the Catalog.md



Note that this will only remove this piece of data from the package. It will not delete the actual data itself.

## Adding metadata to a package

Packages support metadata anywhere in the package. To set metadata on package entries or directories, use the `meta` argument:


```python
p = (quilt3.Package()
    .set("data.csv", "data.csv", meta={"type": "csv"})
    .set_dir("stuff/", "stuff/", meta={"origin": "unknown"})
)
```

You can also set metadata on the package as a whole using `set_meta`.


```python
# set metadata on a package
p.set_meta({"package-type": "demo"})
```




    (local Package)
     └─data.csv
     └─stuff/


