# Command line API

## Core: build, push, and install packages

### `quilt build USER/PACKAGE PATH`
`PATH` may be a `build.yml` file or a directory. If a directory is given, Quilt will internally generate a build file (useful, e.g. for directories of images).

`build.yml` is for users who want fine-grained control over parsing.

### `quilt push USER/PACKAGE [--public ￨ --team]` 
Stores the package in the registry |

### `quilt install USER/PACKAGE[/SUBPATH/...] [-x HASH ￨ -t TAG ￨ -v VERSION] [--force] [--meta-only]`
 Installs a package or sub-package.
 * `--force` - skips yes/no prompt in the case of overwrite
 * `--meta-only` - install only the package metadata (useful for filtering large packages) 

### `quilt install @FILE=quilt.yml`
 Installs all specified packages using the requirements syntax (above) |

### `quilt delete USER/PACKAGE`
Removes the package from the registry. Does not delete local data.

## Versioning
### `quilt log USER/PACKAGE`
Display push history

### `quilt version list USER/PACKAGE`
Display versions of a package

### `quilt version add USER/PACKAGE VERSION HASH`
Associate a version with a hash

### `quilt tag list USER/PACKAGE`
List available tags

### `quilt tag add USER/PACKAGE TAG HASH`
Associate a tag with a hash

### `quilt tag remove USER/PACKAGE TAG`
Remove a tag

## Access

### `quilt login [TEAM]`
Authenticate to a registry

### `quilt access list USER/PACKAGE`
List user who have access to a package |

### `quilt access add USER/PACKAGE USER_OR_GROUP`
Grant read access to a user or group (one of `public` or `team`)

### `quilt access remove USER_OR_GROUP`
Remove read access

## Local storage
### `quilt ls`
List installed packages

### `quilt rm USER/PACKAGE`
Remove a package from local storage (but not from the registry)

## Registry search
`quilt search "SEARCH STRING"`
Search registry for packages by user or package name

## Export a package or subpackage

### `quilt export USER/PACKAGE`
Export data to current dir 
### `quilt export USER/PACKAGE DEST`
Export data to specified destination

`quilt export USER/PACKAGE [DEST] --force `
Overwrite files at destination

### `quilt export USER/PACKAGE [DEST] [--symlinks]`
Export data, using symlinks where possible.

If a node references raw (file) data, symlinks may be used instead of copying data when exporting.

####  _Caution when using symlinks_
* When using any OS
  * If a file is edited, it may corrupt the local quilt repository. Preventing this is up to the user.
* When using Windows
  * Symlinks may not be supported
  * Symlinks may require special permissions
  * Symlinks may require administrative access (even if an administrator has the appropriate permissions)
