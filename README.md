[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/quilt-data/Lobby) ![docs on_gitbook](https://img.shields.io/badge/docs-on_gitbook-brightgreen.svg)


| OS | `master` status |
|----|--------------------|
| <img height="20" src="http://icons.iconarchive.com/icons/dakirby309/simply-styled/256/OS-Linux-icon.png"> | [![Linux](https://travis-ci.org/quiltdata/quilt.svg?branch=master)](https://travis-ci.org/quiltdata/quilt/branches) |
| <img height="20" src="http://icons.iconarchive.com/icons/icons8/windows-8/128/Systems-Mac-Os-icon.png"> | [![CircleCI branch](https://img.shields.io/circleci/project/github/quiltdata/quilt/master.svg)](https://circleci.com/gh/quiltdata/quilt/tree/master) |
| <img height="20" src="http://icons.iconarchive.com/icons/dakirby309/windows-8-metro/128/Folders-OS-Windows-8-Metro-icon.png"> | [![Windows](https://ci.appveyor.com/api/projects/status/tnihllrbmm08x0lt/branch/master?svg=true)](https://ci.appveyor.com/project/quiltdata/quilt-compiler/branch/master) |


# Docs

Visit [docs.quiltdata.com](https://docs.quiltdata.com/). Or [browse the docs on GitHub](/docs/SUMMARY.md).

# Manage data like code
Quilt provides versioned, reusable building blocks for analysis in the form of _data packages_. A data package may contain data of any type or size. In spirit, Quilt does for data what package managers and Docker registries do for code: provide a centralized, collaborative store of record.

## Getting started tutorial
* [Reproducible Data Dependencies for Python](https://blog.jupyter.org/reproducible-data-dependencies-for-python-guest-post-d0f68293a99)

## Benefits

* **Reproducibility** - Imagine source code without versions. Ouch. Why live with un-versioned data? Versioned data makes analysis reproducible by creating unambiguous references to potentially complex data dependencies.
* **Collaboration and transparency** - Data likes to be shared. Quilt offers a centralized data warehouse for finding and sharing data.
* **Auditing** - the registry tracks all reads and writes so that admins know when data are accessed or changed
* **Less data prep** - the registry abstracts away network, storage, and file format so that users can focus on what they wish to do with the data.
* **Deduplication** - Data fragments are hashed with `SHA256`. Duplicate data fragments are written to disk once globally per user. As a result, large, repeated data fragments consume less disk and network bandwidth.
* **Faster analysis** - Serialized data loads 5 to 20 times faster than files. Moreover, specialized storage formats like Apache Parquet minimize I/O bottlenecks so that tools like Presto DB and Hive run faster.

## Commands

Here are the basic Quilt commands:

<img width="320" src="https://raw.githubusercontent.com/quiltdata/resources/master/img/big-picture.png" />

## Service
Quilt is offered as a managed service at [quiltdata.com](https://quiltdata.com).

## Architecture
Quilt consists of three source-level components:

1. A [data catalog](catalog)
    - Displays package meta-data in HTML
    - Implemented with JavaScript with redux, sagas
    
2. A [data registry](registry)
    - Controls permissions
    - Stores pacakge fragments in blob storage
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
