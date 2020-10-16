Data in Quilt is organized in terms of **data packages**. A data package is a logical group of files, directories, and metadata.

## Initializing a package

To edit a new empty package, use the package constructor:


```python
import quilt3
p = quilt3.Package()
```

To edit a preexisting package, we need to first make sure to install the package:


```python
quilt3.Package.install(
    "examples/hurdat",
    "s3://quilt-example",
)
```

    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 5902.48entries/s]

    Successfully installed package 'examples/hurdat', tophash=f8d1478 from s3://quilt-example


    


Use `browse` to edit the package:


```python
p = quilt3.Package.browse('examples/hurdat')
```

    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 9920.30entries/s]


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
p.set("data.csv", "data.csv")
p.set("banner.png", "s3://quilt-example/imgs/banner.png")

# or grab everything in a directory at once using `set_dir`
# ie p.set_dir("stuff/", "/path/to/stuff/"),
# p.set_dir("things/", "s3://path/to/things/")

# create test directory
import os
os.mkdir("data")
p.set_dir("stuff/", "./data/")
p.set_dir("imgs/", "s3://quilt-example/imgs/")
```




    (remote Package)
     └─banner.png
     └─data.csv
     └─imgs/
       └─banner.png
     └─stuff/



The first parameter to these functions is the *logical key*, which will determine where the file lives within the package. So after running the commands above our package will look like this:


```python
p
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
p.set("data.csv")
```




    (local Package)
     └─data.csv



Another useful trick. Use `"."` to set the contents of the package to that of the current directory:


```python
# switch to a test directory and create some test files
import os
%cd data/
os.mkdir("stuff")
with open("new_data.csv", "w") as f:
    f.write("id, value\na, 42")

# set the contents of the package to that of the current directory
p.set_dir(".", ".")
```




    (local Package)
     └─data.csv
     └─new_data.csv



## Deleting data in a package

Use `delete` to remove entries from a package:


```python
p.delete("data.csv")
```




    (local Package)
     └─new_data.csv



Note that this will only remove this piece of data from the package. It will not delete the actual data itself.

## Adding metadata to a package

Packages support metadata anywhere in the package. To set metadata on package entries or directories, use the `meta` argument:


```python
p = quilt3.Package()
p.set("data.csv", "new_data.csv", meta={"type": "csv"})
p.set_dir("stuff/", "stuff/", meta={"origin": "unknown"})
```




    (local Package)
     └─data.csv
     └─stuff/



You can also set metadata on the package as a whole using `set_meta`.


```python
# set metadata on a package
p.set_meta({"package-type": "demo"})
```




    (local Package)
     └─data.csv
     └─stuff/


