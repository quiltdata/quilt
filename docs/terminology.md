# Packages defined
A Quilt data package is a tree of serialized data wrapped in a software module. You can think of a package as a miniature, virtualized filesystem accessible to a variety of languages and platforms.

Each Quilt package has a unique _handle_ of the form `USER_NAME/PACKAGE_NAME`.

Packages are stored in a server-side registry. The registry controls permissions and stores package meta-data, such as the revision history. Each package has a web landing page for documentation, like this: [like this one](https://quiltdata.com/package/uciml/iris) for `uciml/iris`.

The data in a package are tracked in a hash tree. The _tophash_ for the tree is the hash of all hashes of all data in the package. The combination of a package handle and tophash is a _package_ instance. Package instances are immutable.

Leaf nodes in the package tree are called _fragments_ or _objects_. Installed fragments are de-duplicated and kept in a local [_object store_](./quilt_repository_format.md).

# Package lifecycle

Quilt's core commands are _build_, _push_, and _install_. To use a data package you _import_ it.

* **build** creates a package
 * Quilt uses [pandas](http://pandas.pydata.org/) to parse tabular file formats into data frames and [pyarrow](https://arrow.apache.org/docs/python/) to serialize data frames to [Parquet format](https://parquet.apache.org/).

* **push** stores a package in a server-side registry
  * Packages are registered against a Flask/MySQL endpoint that controls permissions and keeps track of where data lives in blob storage (S3 for the Free tier).
* **install** downloads a package
  * After a permissions check the client receives a signed URL to download the package from blob storage.
  * Packages are installed in the current directory in folder named `quilt_modules`

* **import** exposes your package to code
  * Quilt data packages are wrapped in a Python module so that users can import data like code: `from quilt.data.USER_NAME import PACKAGE_NAME`.
  * Data `import` is lazy to minimize I/O. Data are only loaded from disk if and when the user references the data directly.
  * Quilt looks for packages in the current directory followed by all ancestors, in ascending order.

## Diagram

<img width="320" src="https://github.com/quiltdata/resources/blob/955656180ef6398a2729c7ebc28e5dc708f26bd3/img/big-picture.png?raw=true" />
  
***







