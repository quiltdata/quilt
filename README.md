<!--
READ THIS IF YOU ARE EDITING THIS FILE
* /README.md and docs/README.md should remain identical copies, (symlinks don't work)
* Do not use relative links (e.g. ./foo.md) in either of these files,
  as the links will break in one of the two copies. Instead, use links to
  the files on GitHub
  (e.g. https://github.com/quiltdata/quilt/blob/master/docs/buildyml.md),
  which Gitbook correctly interprets as intra-docs links.
!-->

[![docs on_gitbook](https://img.shields.io/badge/docs-on_gitbook-blue.svg?style=flat-square)](https://docs.quiltdata.com/)
[![chat on_slack](https://img.shields.io/badge/chat-on_slack-blue.svg?style=flat-square)](https://slack.quiltdata.com/)

`master` status

 [![Linux](https://travis-ci.org/quiltdata/quilt.svg?branch=master)](https://travis-ci.org/quiltdata/quilt/branches)
 [![CircleCI](https://circleci.com/gh/quiltdata/quilt/tree/master.svg?style=svg)](https://circleci.com/gh/quiltdata/quilt/tree/master)
[![Windows](https://ci.appveyor.com/api/projects/status/7s4sufpi2gr90ase/branch/master?svg=true)](https://ci.appveyor.com/project/akarve/quilt/branch/master)

# Manage data like code

Quilt provides versioned, reusable building blocks for analysis in the form of _data packages_. A data package may contain data of any type or size. In spirit, Quilt does for data what package managers do for code: provide a centralized, collaborative store of record.

## [Video Demo](https://www.youtube.com/watch?v=bKIV1GUVLPc)

## Benefits

* **Reproducibility** - Imagine source code without versions. Ouch. Why live with un-versioned data? Versioned data makes analysis reproducible by creating unambiguous references to potentially complex data dependencies.

* **Collaboration and transparency** - Data likes to be shared. Quilt offers a centralized data warehouse for finding and sharing data.

* **Auditing** - the registry tracks all reads and writes so that admins know when data are accessed or changed

* **Less data prep** - the registry abstracts away network, storage, and file format so that users can focus on what they wish to do with the data.

* **De-duplication** - Data fragments are hashed with `SHA256`. Duplicate data fragments are written to disk once globally per user. As a result, large, repeated data fragments consume less disk and network bandwidth.

* **Faster analysis** - Serialized data loads 5 to 20 times faster than files. Moreover, specialized storage formats like Apache Parquet minimize I/O bottlenecks so that tools like Presto DB and Hive run faster.

## Key concepts

### Data package
A Quilt data package is a tree of data wrapped in a Python module. You can think of a package as a miniature, virtualized filesystem accessible to a variety of languages and platforms.

Each Quilt package has a unique _handle_ of the form `USER_NAME/PACKAGE_NAME`.

Packages are stored in a server-side _registry_. The registry controls permissions and stores package meta-data, such as the revision history. Each package has a web landing page for documentation, [like this one](https://quiltdata.com/package/uciml/iris) for `uciml/iris`.

The data in a package are tracked in a hash tree. The _tophash_ for the tree is the hash of all hashes of all data in the package. The combination of a package handle and tophash form a package _instance_. Package instances are immutable.

Leaf nodes in the package tree are called _fragments_ or _objects_. Installed fragments are de-duplicated and kept in a local [object store](./repo-format.md).

### Package lifecycle

<img width="320" src="https://github.com/quiltdata/resources/blob/955656180ef6398a2729c7ebc28e5dc708f26bd3/img/big-picture.png?raw=true" />

### Core commands

### `build` creates a package
`build` hashes and serializes data. All data and metadata are tracked in a
hash-tree that specifies the structure of the package.

By default:
* Unstrcutured and semi-structured data are copied "as is"
* Tabular file formats (like CSV, TSV, XLS, etc.) are parsed with
[pandas](http://pandas.pydata.org/) and serialized to Parquet with
[pyarrow](https://arrow.apache.org/docs/python/).

You may override the above defaults, for example if you wish data to remain with the `kwargs` and `transform`
in CSV format, with the `transform` and `kwargs` keywords in
[`build.yml`](https://github.com/quiltdata/quilt/blob/master/docs/buildyml.md).


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
Quilt consists of three components. See the [contributing docs](https://github.com/quiltdata/quilt/blob/master/docs/CONTRIBUTING.md) for further details.
    
<img width="640" src="https://raw.githubusercontent.com/quiltdata/resources/master/img/arch.png" />
