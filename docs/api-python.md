# Package handles
* Packages are referenced by a handle of the form `OWNER/NAME`.
* Teams packages include a prefix, `TEAM:OWNER/NAME`

# Building, pushing, and installing packages
| Command line | Python | Description |
| --- | --- | --- |
| `quilt build USER/PACKAGE PATH` | `quilt.build("USER/PACKAGE", "PATH")` | `PATH` may be a `build.yml` file or a directory. If a directory is given, Quilt will internally generate a build file (useful, e.g. for directories of images). `build.yml` is for users who want fine-grained control over parsing. |
| `quilt push USER/PACKAGE [--public|--team]` | `quilt.push("USER/PACKAGE", public=False, team=False)` | Stores the package in the registry |
| `quilt install USER/PACKAGE[/SUBPATH/...]` | `quilt.install("USER/PACKAGE[/SUBPATH/...]", hash="HASH", tag="TAG", version="VERSION")` | Installs a package or sub-package |
| `quilt install @QUILT_YAML` | Not supported | Installs all specified packages |
| `quilt delete USER/PACKAGE` | `quilt.delete("USER/PACKAGE")` | Removes the package from the registry. Does not delete local data. |

## Build tips
* A `README.md` is recommended at the root of your package. README files support [full markdown syntax via remarkable](https://jonschlinkert.github.io/remarkable/demo/).

## Short hashes
All commands such as `quilt install` support "short hashes". Any unique prefix of a hash will be matched against the longer hash.  For example, `quilt install akarve/examples -x 4594b58d64dd9c98b79b628370618031c66e80cbbd1db48662be0b7cac36a74e` can be shortened to `quilt install akarve/examples -x 4594b5`. In practice, 6-8 characters is usually sufficient to achieve uniqueness.


# Navigation and package contents
* `quilt.inspect("USER/PACKAGE")` shows package columns, types, and shape
* `NODE._keys()` returns a list of all children
* `NODE._data_keys()` returns a list of all data children (leaf nodes containing actual data)
* `NODE._group_keys()` returns a list of all group children (groups are like folders)

## Example
```
from quilt.data.uciml import wine
In [7]: wine._keys()
Out[7]: ['README', 'raw', 'tables']
In [8]: wine._data_keys()
Out[8]: ['README']
In [9]: wine._group_keys()
Out[9]: ['raw', 'tables']
```

# Versioning
* `quilt.log(USER/PACKAGE)` to see the push history
* `quilt.version_list(USER/PACKAGE)` to see versions of a package
* `quilt.version_add(USER/PACKAGE, VERSION, HASH)` to associate a version with a hash
* `quilt.tag_list(USER/PACKAGE)` to list tags
* `quilt.tag_add(USER/PACKAGE, TAG, HASH)` to associate a tag with a a hash
* The most recent push is automatically tagged `"latest"`
* `quilt.tag_remove(USER/PACKAGE, TAG)` to remove a tag

# Access
* `quilt.login(["TEAM_NAME"])` to authenticate (required to push packages)
* `quilt.access_list(USER/PACKAGE)` to see who has access to a package
* `quilt.access_add(USER/PACKAGE, ANOTHER_USER)` to add read access
* `quilt.access_add(USER/PACKAGE, "public")` makes a package world readable
* `quilt.access_remove(USER/PACKAGE, EXISTING_USER)` to remove read access

# Manage local storage
* `quilt.ls()` to show installed packages
* `quilt.rm("USER/PACKAGE")` to remove a package from the local store

# Search
* `quilt.search("SEARCH STRING")` to search for packages by user or package name

# Import and use data
`from quilt.data.USER import PACKAGE`

## Package contents
Packages contain three types of nodes:
* `PackageNode` - the root of the package tree
* `GroupNode` - like a folder; may contain one or more `GroupNode` or `DataNode` objects
* `DataNode` - a leaf node in the package; contains actual data

## Working with package contents
* List node contents with dot notation: `PACKAGE.NODE.ANOTHER_NODE`
* Retrieve the contents of a `DataNode` with `_data()`, or simply `()`: `PACKAGE.NODE.ANOTHER_NODE()`
  * Columnar data (`XLS`, `CSV`, `TSV`, etc.) returns as a `pandas.DataFrame`
  * All other data types return a string to the path of the object in the package store
