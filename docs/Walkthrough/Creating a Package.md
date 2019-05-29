Data in Quilt is organized in terms of **data packages**. A data package is a logical group of files, directories, and metadata:

```python
import quilt
# initialize a package
p = quilt3.Package()
```

## Adding data to a package

Use the `set` and `set_dir` commands to add individual files and whole directories, respectively, to a `Package`:

```python
# add entries individually using `set`
p = (p
     .set("foo.csv", "/local/path/foo.csv")
     .set("bar.csv", "s3://bucket/path/bar.csv")
    )

# or grab everything in a directory at once using `set_dir`
p = (p
     .set_dir("stuff/", "/path/to/stuff/")
     .set_dir("things/", "s3://path/to/things/")
    )
```

The first parameter to these functions is the *logical key*, which will determine where the file lives within the package. So after running the commands above our package will look like this:

```python
>>> print(p)

(remote Package)
 └─foo.csv
 └─bar.csv
 └─stuff
   └─...
 └─things
   └─...
```

The second parameter is the *physical key*, which states the file's actual location. The physical key may point to either a local file or a remote object (with an `s3://` path).

If the physical key and the logical key are the same, you may omit the second argument:

```bash
# assuming foo.csv is in the current directory
$ python
>>> print(p.set("foo.csv"))

(local Package)
 └─foo.csv
```

Another useful trick. Use `"/"` to set the contents of the package to that of the current directory:

```bash
# assuming foo.csv and bar/baz.csv
# are in the current directory
$ python
>>> print(p.set_dir("/", "./"))

(local Package)
 └─foo.csv
 └─bar
   └─baz.csv
```

## Deleting data in a package

Use `delete` to remove entries from a package:

```python
p.delete("bam.png")
```

Note that this will only remove this piece of data from the package. It will not delete the actual data itself.

## Adding metadata to a package

Packages support metadata anywhere in the package. To set metadata on package entries or directories, use the `meta` argument:

```python
p = (quilt3.Package()
    .set("foo.csv", "foo.csv", meta={"type": "csv"})
    .set_dir("stuff/", "stuff/", meta={"origin": "unknown"})
)
```

You can also set metadata on the package as a whole using `set_meta`.

```python
# set metadata on a package
p.set_meta({"package-type": "demo"})
```
