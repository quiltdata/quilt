# Quilt is a data package manager
Package, serialize, and version data with Quilt.

Quilt consists of a client-side data compiler (this repository) and a 
[server-side registry](https://quiltdata.com).

To learn more:
* Tutorial: [Data packages](https://blog.quilt.data.com)
* Motivation: [Why and how to manage data like code](https://blog.quiltdata.com/its-time-to-manage-data-like-source-code-3df04cd312b8)

# Command summary
* `quilt -h` for a list of commands
* `quilt CMD -h` for info about a command
* `quilt login`
* `quilt build USER/PACKAGE FILE.YML`
* `quilt push USER/PACKAGE` stores the package in the registry
* `quilt install [-x HASH | -v VERSION | -t TAG] USER/PACKAGE` installs a package
* `quilt access list USER/PACKAGE` to see who has access to a package
* `quilt access {add, remove} USER/PACKAGE ANOTHER_USER` to set access
* `quilt log USER/PACKAGE` to see all changes to a package
* `quilt version list USER/PACKAGE` to see versions of a package
* `quilt version add USER/PACKAGE VERSION HASH` to create a new version
* `quilt tag list USER/PACKAGE` to see tags of a package
* `quilt tag add USER/PACKAGE TAG HASH` to create a new tag
* `quilt tag remove USER/PACKAGE TAG` to delete a tag

# Known Issues
## HDF5
Pytables has trouble with HDF5 dependencies. Try the following:
- Mac:
  - `brew install hdf5@1.8` (pytables currently doesn't work with 1.10)
  - Add to `.bash_profile`: `export HDF5_DIR="/usr/local/opt/hdf5@1.8/"`  
- Linux: `sudo apt-get build-dep python-tables`

# Version and track your packages

## Tags
```
quilt tag list USER/PACKAGE
```
`latest: 7f6ca2546aba49be878c7f407bb49ef9388c51be716360685bce2d2cdae4fcd1`

The tag `latest` is automatically added to the most recently pushed instance of a data package. To add a new tag, copy the package hash for the package instance you want to tag and run:
```
quilt tag add USER/PACKAGE NEW_TAG PKG_HASH
```
## Versions
```
quilt tag list USER/PACKAGE
```
`latest: 7f6ca2546aba49be878c7f407bb49ef9388c51be716360685bce2d2cdae4fcd1`  
`newtag: 7f6ca2546aba49be878c7f407bb49ef9388c51be716360685bce2d2cdae4fcd1`

To create a new version, copy the package hash for the package instance you want to tag and run:
```
quilt version add USER/PACKAGE VERSION PKG_HASH
quilt version list USER/PACKAGE
```
`0.0.1: 7f6ca2546aba49be878c7f407bb49ef9388c51be716360685bce2d2cdae4fcd1`

# Serialization (via pandas)
Supported Pandas column types (via dtype:)
* int
* bool
* float
* complex
* str
* unicode
* buffer

Everything else becomes type object. See [dtypes](https://docs.scipy.org/doc/numpy/reference/arrays.dtypes.html).

# Developer
- `pip install pylint pytest pytest-cov`
- `pytest` will run any `test_*` files in any subdirectory
- All new modules, files, and functions should have a corresponding test 
- Track test code coverage by running: `python -m pytest --cov=quilt/tools/ --cov-report html:cov_html quilt/test -v`
- View coverage results by opening cov_html/index.html

## Local installation
1. `git clone https://github.com/quiltdata/quilt.git`
1. `cd quilt`
1. From the repository root: `pip install -e .`
