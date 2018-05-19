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
Top-level package nodes have a `_filter` method that accepts either a dictionary or a lambda.

`_filter` returns a proper sub-tree of the parent package that contains only the nodes that match the filter.

If a group matches the filter, the group and all of its desendants are included.

If a group or leaf matches the filter, it's root-to-descendant path from the original package is preserved.

#### Filter with a dict 
Dictionary filters supports two properies, `name` and `meta`:

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
