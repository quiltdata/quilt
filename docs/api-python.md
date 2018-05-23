# Python API

## Core: build, push, and install packages

### `quilt.build("USER/PACKAGE", "PATH")`

`PATH` may be a `build.yml` file or a directory. If a directory is given, Quilt will internally generate a build file (useful, e.g. for directories of images). `build.yml` is for users who want fine-grained control over parsing. |

### `quilt.push("USER/PACKAGE", is_public=False, is_team=False)`
Stores the package in the registry

### `quilt.install("USER/PACKAGE[/SUBPATH/...]", hash="HASH", tag="TAG", version="VERSION")`
 Installs a package or sub-package
 
 
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
### `pkg._filter(DICT_OR_LAMBDA)`
Package root nodes have a `_filter` method that accepts either a dictionary or a lambda.

 `_filter` always returns nodes in the same position as they are found in the parent
 package. (The parent package in `pkg._filter(...)` is `pkg`.) Therefore, in addition
 to nodes that match the filter, `_filter` will include the following:
* All desendants of a matching node (so that mathcing groups include all descendants)
* All ancestors of a matching node (so that the position in the tree remains unchanged)

#### Filter with a dict 
Dictionary filters support two properies, `name` and `meta`:

``` python
pkg = wine._filter({'name': 'README'})  # Just the readme
pkg = wine._filter({'meta': {'foo': 'bar'}})  # The group we created earlier
pkg = wine._filter({'meta': {'_system': {'transform': 'csv'}}})  # Dataframes created from CSVs
```

#### Filter with a lambda function
Lambda filters accept the node object and its name. It provides more flexibility, but requires more care when accessing values:

``` python
pkg = wine._filter(lambda node, name: node._meta.get('_system', {}).get('filepath', '').endswith('.data'))
```

## Export a package or subpackage

###  `quilt.export("USER/PACKAGE")`
Export data to current dir

###  `quilt.export("USER/PACKAGE", "DEST")`
Export data to specified destination

###  `quilt.export("USER/PACKAGE", "DEST", force=True)`
Overwrite files at destination

### `quilt export USER/PACKAGE [DEST] [--symlinks]`
Export data, using symlinks where possible. 

If a node references raw (file) data, symlinks may be used instead of copying data when exporting.

####  _Caution when using symlinks_
* When using any OS
  * If a file is edited, it may corrupt the local quilt repository. Preventing this is up to the user.
* When using Windows
  * Symlinks may not be supported
  * Symlinks may require special permissions
  * Symlinks may require administrative access (even if an administrator has the appropriate permissions)

## Import and use data
For a package in the public cloud:
```python
from quilt.data.USER import PACKAGE
```
For a package in a team registry:
```python
from quilt.team.TEAM_NAME.USER import PACKAGE
```

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
  * Provide a custom deserialzer by passing a function to `data(asa=FUNCTION)` with the signature `function(NODE, LIST_OF_FILE_PATHS)`. A single node can contain data in multiple files (e.g., a DataFrame stored as a set of Parquet files). Calling `data(asa=FUNCTION)` on a GroupNode is currently only allowed for GroupNodes where all children are DataFrames (backed by Parquet files) with a common schema. In that case, FUNCTION is called with the GroupNode object and a list of the paths to all of the Parquet files in all of the child nodes.

### Enumerate package contents
* `quilt.inspect("USER/PACKAGE")` shows package columns, types, and shape
* `NODE._keys()` returns a list of all children
* `NODE._data_keys()` returns a list of all data children (leaf nodes containing actual data)
* `NODE._group_keys()` returns a list of all group children (groups are like folders)
* `NODE._items()` returns a generator of the node's children as (name, node) pairs.

#### Example
```
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

#### Example
```
import pandas as pd
import quilt
quilt.build('USER/PKG') # create new, empty packckage
from quilt.data.USER import PKG as pkg
pkg._set(['data'], pd.DataFrame(data=[1, 2, 3]))
pkg._set(['foo'], "example.txt")
quilt.build('USER/PKG', pkg)
```
This adds a child node named `data` to the new empty package, with the new DataFrame as its value. Then it adds the contents of `example.txt` to a node called `foo`. Finally, it commits this change to disk by building the package with the modified object.

See [the examples repo](https://github.com/quiltdata/examples) for additional usage examples.
