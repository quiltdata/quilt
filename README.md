[![Python](https://img.shields.io/pypi/pyversions/quilt.svg)](https://pypi.python.org/pypi/quilt)  <img height="20" src="http://icons.iconarchive.com/icons/dakirby309/simply-styled/256/OS-Linux-icon.png">[![Linux](https://travis-ci.org/quiltdata/quilt-compiler.svg?branch=master)](https://travis-ci.org/quiltdata/quilt-compiler) - <img height="20" src="http://icons.iconarchive.com/icons/icons8/windows-8/128/Systems-Mac-Os-icon.png">[![Mac](https://circleci.com/gh/quiltdata/quilt-compiler.png)](https://circleci.com/gh/quiltdata) - <img height="20" src="http://icons.iconarchive.com/icons/dakirby309/windows-8-metro/128/Folders-OS-Windows-8-Metro-icon.png">[![Windows](https://ci.appveyor.com/api/projects/status/github/quiltdata/quilt-compiler?svg=true)](https://ci.appveyor.com/project/quiltdata/quilt-compiler)

# Quilt is a package manager for data

With Quilt you can build, push, and install data packages. Data packages are versioned, reusable data that can be  loaded into Python.

## Commands

Here are the basic Quilt commands:

<img width="320" src="https://github.com/quiltdata/resources/blob/955656180ef6398a2729c7ebc28e5dc708f26bd3/img/big-picture.png?raw=true" />

## Components

Quilt consists of two components:

1. A [server-side data registry](registry)
    - Controls permissions
    - Stores pacakge fragments in blob storage
    - Stores package meta-data
    - De-duplicates repeated data fragments
    
2. A [client-side data compiler](compiler)
    - Serializes tabular data to Apache Parquet
    - `build`s packages locally
    - `push`es packages to the registry
    - `pull`s packages from the registry

# Documentation

Visit [docs.quiltdata.com](https://docs.quiltdata.com/).

# Feedback/Discussion

[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/quilt-data/Lobby)
