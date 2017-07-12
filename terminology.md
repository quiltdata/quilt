# Definition

A Quilt data package is a tree of serialized data wrapped in a Python module. You can think of packages as miniature, virtualized filesystems accessible on a variety of languages and platforms.

Each Quilt package has a unique handle of the form `USERNAME/PACKAGE_NAME`.

Packages are stored in a server-side registry, which controls permissions, and stores meta-data such as the revision history. Each package has a web landing page for documentation, like this one: [`uciml/iris`](https://quiltdata.com/package/uciml/iris).



# Lifecycle

Quilt's core commands are _build_, _push_, and _install_. To use a data package you _import_ it.

* **build** creates a package

* **push** stores a package in a server-side registry

* **install** downloads a package

* **import** exposes your package to code

## Diagram

<img width="320" src="https://github.com/quiltdata/resources/blob/955656180ef6398a2729c7ebc28e5dc708f26bd3/img/big-picture.png?raw=true" />
  








