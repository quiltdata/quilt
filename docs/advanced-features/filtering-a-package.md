`quilt3` provides a handful of functions for operating on the contents of a package in an entry-by-entry manner. These are helpful for performing more complicated parsing operations on the package:

```python
import quilt3

# create a package
p = (quilt3.Package()
        .set_dir("foo/", "foo/")
        .set("bar", "bar"))

# element-wise transform entries, outputting a list
# here "lk" is shorthand for "logical_key"
# and "entry" is the package entry
p.map(lambda lk, entry: entry)

# filter out entries not meeting certain criteria
p.filter(lambda lk, entry: 'cool' not in lk)
```

Notice that these functions operate over `(logical_key, entry)` tuples. Each `logical_key` is a string. Each `entry` is `PackageEntry` object, as would be returned if you slice to a leaf node of the package (e.g. `p['bar']`).
