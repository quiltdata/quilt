# Quilt CLI Local Storage

## Motivation
The primary motivation for unifying the local package store is that any Python process will be able to access any locally installed Quilt package. A common point of friction for Quilt users has been that packages built on the command line aren't visible inside Jupyter notebooks if the Jupyter server is running in a different directory. Unifiying the local storage by adopting the Docker storage model solves that problem and also enables useful future features like comparing (diff) package versions and tracking revision history locally without pushing to a registry.

## Directory Structure
This change proposes changing from a hierarchy of separate local package stores(quilt_packages) like npm, to a single store like Docker.

Using the file system is expected to be slower than a database or single-file lookup, but will be thread-safe and still human-readable.

### Objects

```bash
BASE_DIR/objs/
```
Stores binary data objects identified by hash. These objects include compressed raw files and Parquet files. Object hashes are verified and objects are stored only once (deduplication).

### Contents
```bash
BASE_DIR/<owner>/<pkg>/contents/
```
The per-package contents directory ```contents``` uses the file system to store thread-safe mapping of package names, versions and tags to locally installed package instances.

### Tags and Versions
```bash
BASE_DIR/<owner>/<pkg>/tags/
    <tag>:        <hash>
    
BASE_DIR/<owner>/<pkg>/versions/
    <version>:    <hash>
```

## Command Updates
```bash
quilt ls

# Package       Version     Tag     ID      Created     Size
user/package    <version>   <tag>   <hash>  <date>      <bytes on disk>
```

Lists all locally installed package instances. The output of ls shows the package name and any tags or versions associated with the instance.


## Implementation Sketch

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
    - #Alternate: order instances by reverse creation date
    - mark each instance printed in metadata map
    - list all untagged, unversioned instances for the package

### import
- eliminate search for quilt_packages directory
- lookup package hash in contents
    - by tag: package/tags/tag->hash
    - by version: package/versions/version->hash
    - by hash (verify hash is associated with package)
- read package manifest (find by hash)
- parse package tree (as before)

## Future

### Local Add/Remove Tags
```bash
quilt tag add <hash> <tag>
quilt tag rm <hash> <tag>
```

Adds or removes a tag from a package instance in the local store. Adding or removing a local tag has no effect on tags at the registry.

```bash
quilt version add <hash> <version>
quilt version rm <hash> <version>
```

Adds or removes a version from a package instance in the local store. Note: once pushed to a Quilt registry, there is no way to remove a version without deleting the package.

### Propagate Tags and Versions to the Registry on Push
```bash
quilt push <package>
```

Pushes a package instance to the Quilt registry and applies any local tags or versions to the newly pushed instance at the registry.

### Install by Hash, Tag or Version Populates Local Tags & Versions
```bash
quilt install <package> [-t tag] [-v version]
```

Installing a package instance from the Quilt registry will records in the local store any tags or versions associated with the installed instance at the registry.

### quilt rm
Remove local package instances

### quilt cleanup
Remove unlinked binary objects (garbage collection)

### quilt diff <pgk1> <pkg2>
Diff package instances

### build FROM
Import an existing package as the basis for a new package like Docker's FROM.