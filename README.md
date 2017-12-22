[![PyPI](https://img.shields.io/pypi/v/quilt.svg)](https://pypi.python.org/pypi/quilt) [![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/quilt-data/Lobby)


| OS | `master` | Python support |
|----|--------------------|----------------|
| <img height="20" src="http://icons.iconarchive.com/icons/dakirby309/simply-styled/256/OS-Linux-icon.png"> | [![Linux](https://travis-ci.org/quiltdata/quilt.svg?branch=master)](https://travis-ci.org/quiltdata/quilt/branches) | 2.7, 3.4, 3.5, 3.6 |
| <img height="20" src="http://icons.iconarchive.com/icons/icons8/windows-8/128/Systems-Mac-Os-icon.png"> | [![CircleCI branch](https://img.shields.io/circleci/project/github/quiltdata/quilt/master.svg)](https://circleci.com/gh/quiltdata/quilt/tree/master) | 2.7, 3.5, 3.6 |
| <img height="20" src="http://icons.iconarchive.com/icons/dakirby309/windows-8-metro/128/Folders-OS-Windows-8-Metro-icon.png"> | [![Windows](https://ci.appveyor.com/api/projects/status/tnihllrbmm08x0lt/branch/master?svg=true)](https://ci.appveyor.com/project/quiltdata/quilt-compiler/branch/master) | 3.5, 3.6 |


# Docs

Visit [docs.quiltdata.com](https://docs.quiltdata.com/). Or [browse the docs on GitHub](/docs/SUMMARY.md).

# Quilt is a data router

With Quilt you can build, push, and install data packages. Data packages are versioned, reusable data structures that can be  loaded into Python. Quilt is designed to support reproducible, auditable, and compliant workflows.

Core features include:
* Versioning and storage of large data
* Transformation of a variety of file formats into data frames (via pandas and pyarrow)
* De-duplication of repeated data for reduced disk and network footprint

## Commands

Here are the basic Quilt commands:

<img width="320" src="https://raw.githubusercontent.com/quiltdata/resources/master/img/big-picture.png" />

## Architecture

Quilt consists of three components:

1. A [data catalog](https://quiltdata.com/)
    - Displays package meta-data in HTML
    
1. A [data registry](registry)
    - Controls permissions
    - Stores pacakge fragments in blob storage
    - Stores package meta-data
    - De-duplicates repeated data fragments
    
2. A [data compiler](compiler)
    - Serializes tabular data to Apache Parquet
    - Transforms and parses files
    - `build`s packages locally
    - `push`es packages to the registry
    - `pull`s packages from the registry
    
<img width="640" src="https://raw.githubusercontent.com/quiltdata/resources/master/img/arch.png" />
