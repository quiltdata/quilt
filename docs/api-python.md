# Python API

## Core: build, push, and install packages

### `quilt.build("USER/PACKAGE", "PATH")`

`PATH` may be a `build.yml` file or a directory. If a directory is given, Quilt will internally generate a build file (useful, e.g. for directories of images). `build.yml` is for users who want fine-grained control over parsing. |

### `quilt.push("USER/PACKAGE", is_public=False, is_team=False)`
Stores the package in the registry

### `quilt.install(PKG [, hash="HASH", tag="TAG", version="VERSION"] [, force=False] [, meta_only=False])`
 Installs a package or sub-package.

 * `force=True` - skips yes/no prompt in the case of overwrite
 * `meta_only=True` - install only the package metadata (useful for filtering large packages) 

 `PKG` may be any one of the following:
 * A string of the form `"USR/PKG[/SUBPATH...]"`
 * An anonymous package returned by filter: `pkg._filter(...)`
 
###  `quilt.delete("USER/PACKAGE")`
Removes the package from the registry. Does not delete local data.

## Versioning

### `quilt.log(USER/PACKAGE)`
Display push history

### `quilt.version_list(USER/PACKAGE)`
Display versions of a package

### `quilt.version_add(USER/PACKAGE, VERSION, HASH)`
Associate a version with a hash

### `quilt.tag_list(USER/PACKAGE)`
List available tags

### `quilt.tag_add(USER/PACKAGE, TAG, HASH)`
Associate a tag with a hash

### `quilt.tag_remove(USER/PACKAGE, TAG)`
Remove a tag

## Access
###  `quilt.login([TEAM])`
Authenticate to a registry

### `quilt.access_list("USER/PACKAGE")`
List user who have access to a package

### `quilt.access_add("USER/PACKAGE", "USER_OR_GROUP")`
Grant read access to a user or group (one of `public` or `team`)

### `quilt.access_remove("USER/PACKAGE", "USER_OR_GROUP")`
Remove read access

## Local storage
### `quilt.ls()`
List installed packages

### `quilt.rm("USER/PACKAGE")`
Remove a package from local storage (but not from the registry)

## Registry search
###  `quilt.search("SEARCH STRING")`
Search registry for packages by user or package name |


## Filtering
Note that you can `quilt.install("USR/PKG", meta_only=True)` if you wish to filter a large
package based solely on its metadata. This avoids downloading the primary data to disk.

### `pkg._filter(DICT_OR_LAMBDA)`
Package root nodes have a `_filter` method that accepts either a dictionary or a lambda.

 `_filter` always returns nodes in the same position as they are found in the parent
 package. (The parent package in `pkg._filter(...)` is `pkg`.) Therefore, in addition
 to nodes that match the filter, `_filter` will include the following:
* All descendants of a matching node (so that matching groups include all descendants)
* All ancestors of a matching node (so that the position in the tree remains unchanged)

The return value of `_filter` can be passed to `install` as shown below.

#### Filter with a dict 
Dictionary filters support two properties, `name` and `meta`:

``` python
import quilt

pkg = wine._filter({'name': 'README'})  # Just the readme
pkg = wine._filter({'meta': {'foo': 'bar'}})  # The group we created earlier
pkg = wine._filter({'meta': {'_system': {'transform': 'csv'}}})  # Dataframes created from CSVs
# install the filtered subste of the data
quilt.install(pkg);
```

#### Filter with a lambda function
Lambda filters accept the node object and its name. It provides more flexibility, but requires more care when accessing values:

``` python
pkg = wine._filter(lambda node, name: node._meta.get('_system', {}).get('filepath', '').endswith('.data'))
```

## Export a package or subpackage

###  `quilt.export("USER/PACKAGE")`
Export data to current directory.

###  `quilt.export("USER/PACKAGE", "DEST")`
Export data to specified destination.

###  `quilt.export("USER/PACKAGE", "DEST", force=True)`
Overwrite files at destination.

###  `quilt.export("USER/PACKAGE", "DEST", symlinks=False)`
Use symlinks to the Quilt package directory instead of copies of files. This saves disk storage space and reduces disk I/O.  See note below.

### `quilt export USER/PACKAGE [DEST] [--symlinks]` (command-line)
Export data, using symbolic inks where possible. 

If a node references raw (file) data, symbolic links may be used instead of copying data when exporting.

####  _Caution when using symbolic links_
* When using any OS
  * If a file is edited, it may corrupt the local quilt repository. Preventing this is up to the user.
* When using Windows
  * Symbolic links may not be supported
  * Symbolic links may require special permissions
  * Symbolic links may require administrative access (even if an administrator has the appropriate permissions)

## Import and use data

For a package in the public cloud:

```python
from quilt.data.USER import PACKAGE
```

For a package in a team registry:

```python
from quilt.team.TEAM_NAME.USER import PACKAGE
```

### `quilt.load("USR/PKG", hash=None)`

Returns the specified package. You can use `quilt.load` to simultaneously load
different versions of the same package.

> Note, since Python module loads are cached by name, importing different versions of
> the same package using `import` syntax will fail.

## Using packages

Packages contain three types of nodes:
* `PackageNode` - the root of the package tree
* `GroupNode` - like a folder; may contain one or more `GroupNode` or `DataNode` objects
* `DataNode` - a leaf node in the package; contains actual data

### Work with package contents

* List node contents with dot notation: `PACKAGE.NODE.ANOTHER_NODE`
* Retrieve the contents of a `DataNode` with `_data()`, or simply `()`: `PACKAGE.NODE.ANOTHER_NODE()`
  * Columnar data (`XLS`, `CSV`, `TSV`, etc.) returns as a `pandas.DataFrame`
  * All other data types return a string to the path of the object in the package store
  * Provide a custom deserialzer by passing a function to `data(asa=FUNCTION)` with the signature `function(NODE, LIST_OF_FILE_PATHS)`. A single node can contain data in multiple files (e.g., a DataFrame stored as a set of Parquet files). Calling `data(asa=FUNCTION)` on a GroupNode calls FUNCTION with the GroupNode object and a list of the paths to all of the objects in all of the child nodes.

#### Display package images in Jupyter notebooks
##### Install `img` extras
```sh
pip install quilt[img]
```

##### Display
```python
from quilt.data.akarve import BSDS300 as bsd
from quilt.asa.img import plot

bsd.images.test(asa=plot(figsize=(20, 20)))
```
<img src="https://raw.githubusercontent.com/quiltdata/resources/master/img/quilt-asa-plot.png" />

#### Convert package nodes into Pytorch Datasets

##### Install `pytorch` extras, `torchvision`
```sh
pip install quilt[pytorch]
pip install torchvision
```

##### Usage
```python
from quilt.data.akarve import BSDS300 as bsd
from quilt.asa.pytorch import dataset

my_dataset = pkg.mixed.img(asa=dataset(
    include=is_image,
    node_parser=node_parser,
    input_transform=input_transform(crop_size, upscale_factor),
    target_transform=target_transform(crop_size)
))
```

See [quiltdata/pytorch-examples](https://github.com/quiltdata/pytorch-examples/blob/master/super_resolution/data.py#L85)
for futher details.

### Enumerate package contents
* `quilt.inspect("USER/PACKAGE")` shows package columns, types, and shape
* `NODE._keys()` returns a list of all children
* `NODE._data_keys()` returns a list of all data children (leaf nodes containing actual data)
* `NODE._group_keys()` returns a list of all group children (groups are like folders)
* `NODE._items()` returns a generator of the node's children as (name, node) pairs.
* `NODE` is iterable: `for child in NODE:...` 

#### Example
```python
from quilt.data.uciml import wine
In [7]: wine._keys()
Out[7]: ['README', 'raw', 'tables']
In [8]: wine._data_keys()
Out[8]: ['README']
In [9]: wine._group_keys()
Out[9]: ['raw', 'tables']
```

### Edit a package
#### `PACKAGENODE._set(PATH, VALUE)`
Sets a child node. `PATH` is an array of strings, one for each level of the tree. `VALUE` is the new value. If it's a Pandas dataframe, it will be serialized. A string will be interpreted as a path to a file that contains the data to be packaged. Common columnar formats will be serialized into data frames. All other file formats, e.g. images, will be copied as-is.

#### `GROUPNODE._add_group(NAME)` adds an empty `GroupNode` with the given name to the children of `GROUPNODE`.

#### `NODE._meta` allows attaching metadata to a node
Attach JSON metadata to any group or data node by modifying the `_meta` attribute.

The `'_system'` key is reserved; anything assigned to it may get overwritten. Currently, data nodes contain two keys under `'_system'`:
- `'filepath'`: the original path of the file this node was built from
- `'tranform'`: transform applied to the file

#### Example
```python
import pandas as pd
import quilt
quilt.build('USER/PKG') # create new, empty package
from quilt.data.USER import PKG as pkg
pkg._set(['data'], pd.DataFrame(data=[1, 2, 3]))
pkg._set(['foo'], "example.txt")
pkg._meta['author'] = "me"
quilt.build('USER/PKG', pkg)
```
This adds a child node named `data` to the new empty package, with the new DataFrame as its value. Then it adds the contents of `example.txt` to a node called `foo`. Finally, it commits this change to disk by building the package with the modified object.
