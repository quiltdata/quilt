# Quilt Local Storage
Quilt stores local package state in a directory `quilt_packages` in your system's user data directory. To find the location of your `quilt_packages` directory, run:
```bash
quilt ls
```

## Directory Structure
```bash
BASE_DIR/quilt_packages
```
Quilt stores local copies of packages in a single directory, `quilt_packages`. That directory contains both the raw data and metadata for packages including any tags and versions associated with each package instance.

Using files in the file system to store quilt metadata is perhaps slower than in a database or single-file lookup, but individual files are more human-readable, require fewer dependencies to manipulate, and are easier to repair if they get corrupted. Concurrent access to quilt metadata is also easier to manage.

### Objects
```bash
quilt_packages/objs/
```
Stores binary data objects (a.k.a. "fragments") identified by hash. These objects include compressed raw files and Parquet files. Object hashes are verified and objects are stored only once (de-duplication).

### Contents
```bash
quilt_packages/<owner>/<pkg>/contents/
```
The per-package contents directory ```contents``` uses the file system to store a mapping of package names, versions and tags to locally installed package instances.

### Tags and Versions
```bash
quilt_packages/<owner>/<pkg>/tags/
    <tag>:        <hash>
    
quilt_packages/<owner>/<pkg>/versions/
    <version>:    <hash>
```

## Implementation Sketch
Here are quick outlines of how the basic Quilt commands interact with local storage.

### build
- parse build.yml and iterate through package tree:
    - create binary objects and save to objs dir
    - build in-memory package tree
- calculate package instance hash
- save package manifest (id'd by hash)
- add repo:latest tag

### push
- find instance:
    - by pkg/tag
        - lookup hash in pkgname/tags/tag->hash in contents
    - by pkg/version
            - lookup hash in pkgname/versions/version->hash in contents
    - by hash (direct lookup)
- upload binary objects
- post compressed package manifest to registry

### install
- lookup pkg in contents to check for local copy
- warn if present and not force
- lookup hash from registry
- download package manifest
- verify package hash against contents
- save by package manifect (by package hash)
- download and save binary objects (if not present)

### ls
- read all local package instances and build map of metadata:
    - hash: (size, created, etc.)
- read contents and sort by package
- foreach package:
    - lookup versions:
        - list all instances with versions, ordered by version
    - lookup tags:
        - list all instances with tags, ordered by tag
    - alternate:
        - order instances by reverse creation date
        - mark each instance printed in metadata map
        - list all untagged, unversioned instances for the package

### import
- lookup package hash in contents
    - by tag: package/tags/tag->hash
    - by version: package/versions/version->hash
    - by hash (verify hash is associated with package)
- read package manifest (find by hash)
- parse package tree
