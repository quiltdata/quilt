[![docs on_gitbook](https://img.shields.io/badge/docs-on_gitbook-brightgreen.svg)](https://docs.quiltdata.com/)
[![chat on_slack](https://img.shields.io/badge/chat-on_slack-orange.svg?style=flat-square)](https://slack.quiltdata.com/)

 [![Linux](https://travis-ci.org/quiltdata/quilt.svg?branch=master)](https://travis-ci.org/quiltdata/quilt/branches)
 [![CircleCI](https://circleci.com/gh/quiltdata/quilt/tree/master.svg?style=svg)](https://circleci.com/gh/quiltdata/quilt/tree/master)
[![Windows](https://ci.appveyor.com/api/projects/status/7s4sufpi2gr90ase/branch/master?svg=true)](https://ci.appveyor.com/project/akarve/quilt/branch/master)

# Manage data like code

Quilt provides versioned, reusable building blocks for analysis in the form of _data packages_. A data package may contain data of any type or size. In spirit, Quilt does for data what package managers do for code: provide a centralized, collaborative store of record.

## Benefits

* **Reproducibility** - Imagine source code without versions. Ouch. Why live with un-versioned data? Versioned data makes analysis reproducible by creating unambiguous references to potentially complex data dependencies.

* **Collaboration and transparency** - Data likes to be shared. Quilt offers a centralized data warehouse for finding and sharing data.

* **Auditing** - the registry tracks all reads and writes so that admins know when data are accessed or changed

* **Less data prep** - the registry abstracts away network, storage, and file format so that users can focus on what they wish to do with the data.

* **Deduplication** - Data fragments are hashed with `SHA256`. Duplicate data fragments are written to disk once globally per user. As a result, large, repeated data fragments consume less disk and network bandwidth.

* **Faster analysis** - Serialized data loads 5 to 20 times faster than files. Moreover, specialized storage formats like Apache Parquet minimize I/O bottlenecks so that tools like Presto DB and Hive run faster.


## [Demo]

[Video](https://www.youtube.com/embed/bKIV1GUVLPc)

<iframe width="560" height="315" src="https://www.youtube.com/embed/bKIV1GUVLPc" frameborder="0" allowfullscreen></iframe>

## Key concepts
### Data package
A Quilt data package is a tree of serialized data wrapped in a Python module. You can think of a package as a miniature, virtualized filesystem accessible to a variety of languages and platforms.

Each Quilt package has a unique _handle_ of the form `USER_NAME/PACKAGE_NAME`.

Packages are stored in a server-side _registry_. The registry controls permissions and stores package meta-data, such as the revision history. Each package has a web landing page for documentation, [like this one](https://quiltdata.com/package/uciml/iris) for `uciml/iris`.

The data in a package are tracked in a hash tree. The _tophash_ for the tree is the hash of all hashes of all data in the package. The combination of a package handle and tophash form a package _instance_. Package instances are immutable.

Leaf nodes in the package tree are called _fragments_ or _objects_. Installed fragments are de-duplicated and kept in a local [_object store_](./repo-format.md).

### Package lifecycle
[Lifecycle diagram](https://github.com/quiltdata/resources/blob/955656180ef6398a2729c7ebc28e5dc708f26bd3/img/big-picture.png?raw=true")

<img width="320" src="https://github.com/quiltdata/resources/blob/955656180ef6398a2729c7ebc28e5dc708f26bd3/img/big-picture.png?raw=true" />

### Core commands

### `build` creates a package

Quilt uses [pandas](http://pandas.pydata.org/) to parse tabular file formats into data frames and [pyarrow](https://arrow.apache.org/docs/python/) to serialize data frames to [Parquet format](https://parquet.apache.org/).

### `push` stores a package in a server-side registry

Packages are registered against a Flask/MySQL endpoint that controls permissions and keeps track of where data lives in blob storage (S3 for the Free tier).

### `install` downloads a package

After a permissions check the client receives a signed URL to download the package from blob storage.

Installed packages are stored in a local `quilt_modules` folder.
Type `$ quilt ls` to see where `quilt_modules` is located.

### `import` exposes your package to code
Quilt data packages are wrapped in a Python module so that users can import data like code: `from quilt.data.USER_NAME import PACKAGE_NAME`.

Data `import` is lazy to minimize I/O. Data are only loaded from disk if and when the user references the data (usually by adding parenthesis to a package path, `pkg.foo.bar()`).

## Service
Quilt is offered as a managed service at [quiltdata.com](https://quiltdata.com).
Alternatively, users can run their own registries (refer to the [registry documentation](../registry/README.md)).

## Architecture
Quilt consists of 3 components ([diagram](https://raw.githubusercontent.com/quiltdata/resources/master/img/arch.png)):

1. A [data catalog](catalog)
    - Displays package meta-data in HTML
    - Implemented with JavaScript with redux, sagas
    
2. A [data registry](registry)
    - Controls permissions
    - Stores package fragments in blob storage
    - Stores package meta-data
    - De-duplicates repeated data fragments
    - Implemented in Python with Flask and PostgreSQL
    
3. A [data compiler](compiler)
    - Serializes tabular data to Apache Parquet
    - Transforms and parses files
    - `build`s packages locally
    - `push`es packages to the registry
    - `pull`s packages from the registry
    - Implemented in Python with pandas and PyArrow
    
<img width="640" src="https://raw.githubusercontent.com/quiltdata/resources/master/img/arch.png" />
