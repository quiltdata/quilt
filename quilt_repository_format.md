# Quilt CLI Local Storage

## Directory Structure
```bash
objs/
```
Stores binary data objects identified by hash. These objects include compressed raw files and Parquet files. Object hashes are verified and objects are stored only once (deduplication).

```bash
pkgs/
```

Stores package manifest files (JSON format) for all package instances. Package manifests are identified by the hash of the package.

```bash
contents.json
```

Catalog of locally resident packages. The contents manfiest maps identifiers including package name, tags and versions to package instances.

## Contents Manifest
The contents manifest file ```contents.json``` contains a mapping of package names, versions and tags to locally installed package instances.

```json
package:
    <pkgname>:
        tags:
            tag:    <hash>
        versions:
            version:    <hash>
```

## Commands

```bash
quilt ls

# Package       Version     Tag     ID      Created     Size
user/package    <version>   <tag>   <hash>  <date>      <bytes on disk>
```

Lists all locally installed package instances. The output of ls shows the package name and any tags or versions associated with the instance.

```bash
quilt tag add <hash> <tag>
quilt tag rm <hash> <tag>
```

Adds or removes a tag from a package instance.

```bash
quilt version add <hash> <tag>
quilt version rm <hash> <tag>
```

Adds or removes a version from a package instance. Note: once pushed to a Quilt registry, there is no way to remove a version without deleting the package.

```bash
quilt push <package>
```

Pushes a package instance to the Quilt registry. Quilt push will record any local tags or versions to the registry.

```bash
quilt install <package>[:tag:version]
```

Installs a package from the Quilt registry and records any tags or versions associated with it.

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
        - lookup hash in pkgname->tags->tag->hash in contents manfiest
    - by pkg/version
            - lookup hash in pkgname->versions->version->hash in contents manfiest
    - by hash (direct lookup)
- upload binary objects
- post compressed package manifest to registry

### install
- lookup pkg in contents manifest to check for local copy
- warn if present and not force
- lookup hash from registry
- download package manifest
- verify package hash against contents
- save by package manifect (by package hash)
- download and save binary objects (if not present)

### ls
- read all local package instances and build map of metadata:
    - hash: (size, created, etc.)
- read contents manifest and sort by package
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
- lookup package hash in contents manifest
    - by tag: package->tags->tag->hash
    - by version: package->versions->version->hash
    - by hash (verify hash is associated with package)
- read package manifest (find by hash)
- parse package tree (as before)

## Future

### quilt rm
Remove local package instances

### quilt cleanup
Remove unlinked binary objects (garbage collection)

### quilt diff <pgk1> <pkg2>
Diff package instances

### build FROM
Import an existing package as the basis for a new package like Docker's FROM.