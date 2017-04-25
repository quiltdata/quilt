[![Build Status](https://travis-ci.org/quiltdata/quilt.svg?branch=master)](https://travis-ci.org/quiltdata/quilt)

# Package and version data 
Quilt is a data package manager.
Quilt consists of a client-side data compiler (this repository) and a
[server-side registry](https://quiltdata.com), where packages are stored.

## Data packages
A data package is an abstraction that encapsulates and automates data preparation. More concretely, a data package is a tree of serialized data wrapped in a Python module. Each data package has a unique handle, a revision history, and a web page. Packages are stored in a server-side registry that enforces access control.

## Package lifecycle
* **build** to create a package from files
* **push** a package to store it in the registry
* **install** a package to download it locally
* **import** packages to use them in code

<img src="https://github.com/quiltdata/resources/blob/955656180ef6398a2729c7ebc28e5dc708f26bd3/img/big-picture.png" width="320"/>

# Learn
* [Video demo](https://youtu.be/tLdiDqtnnho)
* [Tutorial on data packages](https://blog.ycombinator.com/data-packages-for-fast-reproducible-python-analysis/)
* [Why package data?](https://blog.quiltdata.com/its-time-to-manage-data-like-source-code-3df04cd312b8)

# Future
Quilt currently supports Python. Spark and R support are in the works.

# Questions?
Chat with us on  [quiltdata.com](https://quiltdata.com/). 


# Commands 
* `quilt -h` for a list of commands
* `quilt CMD -h` for info about a command
* `quilt login`
* `quilt build USER/PACKAGE [SOURCE DIRECTORY or FILE.YML]`
* `quilt push USER/PACKAGE` stores the package in the registry
* `quilt install [-x HASH | -v VERSION | -t TAG] USER/PACKAGE` installs a package
* `quilt access list USER/PACKAGE` to see who has access to a package
* `quilt access {add, remove} USER/PACKAGE ANOTHER_USER` to set access
  * `quilt access add public` makes a package visible to the world
* `quilt log USER/PACKAGE` to see all changes to a package
* `quilt version list USER/PACKAGE` to see versions of a package
* `quilt version add USER/PACKAGE VERSION HASH` to create a new version
* `quilt tag list USER/PACKAGE` to see tags of a package
* `quilt tag add USER/PACKAGE TAG HASH` to create a new tag
  * The tag "latest" is automatically added to the most recent push
* `quilt tag remove USER/PACKAGE TAG` to delete a tag

# Known Issues
## Supported Python versions
* 2.7
* ~~3.2~~
* ~~3.3~~
* 3.4
* 3.5
* 3.6

## `pip install quilt` missing HDF5 libs
The following steps should get you up and running:
### Mac:
1. Install [Homebrew](https://brew.sh/)
1. `brew update`
1. `brew install homebrew/science/hdf5@1.8` (pytables doesn't work with hdf5@1.10)
1. Determine your HDF5 directory: `brew --prefix homebrew/science/hdf5@1.8`
1. `export HDF5_DIR=*YOUR_HDF5_DIRECTORY*` (add this line to your .bash_profile)
1. `pip install quilt`

### Linux:
1. `sudo apt-get install libhdf5-serial-dev`
1. `pip install quilt`

# `build.yml` structure and options
See the [Tutorial](https://blog.ycombinator.com/data-packages-for-fast-reproducible-python-analysis/) for details on `build.yml`.
``` yaml
contents:
  GROUP_NAME:
    DATA_NAME:
      file: PATH_TO_FILE
      transform: {id, csv, tsv, ssv, xls, xlsx}
      sep="\t" # tab separated values
      # or any key-word argument to [pandas.read_csv](http://pandas.pydata.org/pandas-docs/stable/generated/pandas.read_csv.html)
```

## Column types
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

## Install latest from `master`
- `pip install git+https://github.com/quiltdata/quilt.git`

## Local installation
1. `git clone https://github.com/quiltdata/quilt.git`
1. `cd quilt`
1. From the repository root: `pip install -e .`
