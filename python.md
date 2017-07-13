# Permissions
* `quilt.login()` to authenticate
  * Users must authenticate to push packages
* `quilt.access_list(USER/PACKAGE)` to see who has access to a package
* `quilt.access_add(USER/PACKAGE, ANOTHER_USER)` to add read access
 * `quilt.access_add(USER/PACKAGE, "public")` makes a package world readable
* `quilt.access_remove(USER/PACKAGE, EXISTING_USER)` to remove read access


# Core
* `quilt.ls()` to list installed packages
* `quilt.build(USER/PACKAGE, PATH_TO_DIR_OR_BUILD_YML)` to build a package
* `quilt.push(USER/PACKAGE, public=bool)` stores the package in the registry
 * Quilt's Free tier supports only `public == True`
* `quilt.install(USER/PACKAGE, [hash=HASH, tag=TAG, version=VERSION])` installs a package

# Versioning
* `quilt.log(USER/PACKAGE)` to see the push history
* `quilt.version_list(USER/PACKAGE)` to see versions of a package
* `quilt.version_add(USER/PACKAGE, VERSION, HASH)` to associate a version with a hash
* `quilt.tag_list(USER/PACKAGE)` to list tags
* `quilt.tag_add(USER/PACKAGE, TAG, HASH)` to associate a tag with a a hash
 * The most recent push is automatically tagged `"latest"`
* `quilt.tag_remove(USER/PACKAGE, TAG)` to remove a tag

# Import and retrieve
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
  * All other data types return a string to the path of the package object in the local `quilt_modules` directory.

***