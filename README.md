[![Build Status](https://travis-ci.org/quiltdata/quilt-compiler.svg?branch=master)](https://travis-ci.org/quiltdata/quilt-compiler)
[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/quilt-data/Lobby)
[![Python](https://img.shields.io/pypi/pyversions/quilt.svg)](https://pypi.python.org/pypi/quilt)

# Quilt is a package manager for data
With Quilt you can build, push, and install data packages.
For more on the design goals of Quilt, visit [docs.quiltdata.com](https://docs.quiltdata.com/).

# Get started
Visit [docs.quiltdata.com](https://docs.quiltdata.com) for installation, getting started, tutorials, and more.

# Components

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
    
<img width="320" src="https://github.com/quiltdata/resources/blob/955656180ef6398a2729c7ebc28e5dc708f26bd3/img/big-picture.png?raw=true" />

