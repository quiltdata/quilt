# Packages defined

A Quilt data package is a tree of serialized data wrapped in a Python module. You can think of a package as a miniature, virtualized filesystem accessible to a variety of languages and platforms.

Each Quilt package has a unique _handle_ of the form `USER_NAME/PACKAGE_NAME`.

Packages are stored in a server-side registry, which controls permissions, and stores meta-data, such as the revision history. Each package has a web landing page for documentation, like this: [`uciml/iris`](https://quiltdata.com/package/uciml/iris).

# Package lifecycle

Quilt's core commands are _build_, _push_, and _install_. To use a data package you _import_ it.

* **build** creates a package
 * Quilt uses `pandas` to parse tabular file formats into data frames and `pyarrow` to serialize data frames to Parquet.

* **push** stores a package in a server-side registry
  * Packages are registered against a Flask/MySQL endpoint that controls permissions and keeps track of where data lives in blob storage (S3 for the Free tier).
* **install** downloads a package
  * After a permissions check the client receives a signed URL to download the package in question.

* **import** exposes your package to code
  * Quilt data packages are wrapped in a Python module so that users can import data like code: `from quilt.data.USER_NAME import PACKAGE_NAME`.

<br />
<img width="320" src="https://github.com/quiltdata/resources/blob/955656180ef6398a2729c7ebc28e5dc708f26bd3/img/big-picture.png?raw=true" />
  








