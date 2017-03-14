# Help
Chat with us via the orange icon on [quiltdata.com](https://quiltdata.com/).

# Motivation
Less data plumbing and more data science. Quilt provides the "dataset management" infrastructure for data scientists so that they can focus on analysis.
* Access data frames [5X to 20X faster](http://wesmckinney.com/blog/pandas-and-apache-arrow/).
Quilt stores data frames in high-efficiency, memory-mapped binary formats like HDF5.
* Version your data. Pull packages by version number or tag.
* Publish data packages for the benefit of the community.
* Satisfy your data dependencies with one command, `quilt install dependency`.

# What is Quilt?
[Quilt](https://quiltdata.com/) is a data package manager. A data package is a namespace of binary data frames.
You can use data packages from the community, or publish packages for others to use.

`quilt` is the command-line client that builds, retrieves, and stores
packages. `quilt` works in conjunction with a server-side registry,
not covered in this document. `quilt` currently pushes to and pulls from
the registry at [quiltdata.com](https://quiltdata.com/package/examples/wine).


# Known Issues
- `Python 3.6` - Install fails due to missing HDF5 dependencies. Try Python 3.5. For example if you're using Anaconda, create a 3.5 environment: `conda create -n ENV python=3.5`.
-  `quilt/test/build.yml` relies on pickle and is therefore not compatible between Python 2 and Python 3.
- Anaconda with python 2.7 has an old version of `setuptools`. Strangely, `pip install --upgrade setuptools` run three times, yes three times, will ultimately succeed.


# Quick Start
1. Open Terminal
1. `$ pip install quilt`
1. `$ quilt install examples/wine` (install a sample package)
1. `$ python` (fire up python)
1. You've got data frames
```python
from quilt.data.examples import wine
wine.quality.red # this is a pandas.DataFrame
```

# Tutorial

## Install `quilt`
- `pip install git+https://github.com/quiltdata/quilt.git` (more up-to-date than `pip install quilt`)

## Install a package
Let's install the public package [examples/wine](https://quiltdata.com/package/examples/wine)
- `quilt install examples/wine`

Now let's fire up Python and import the package.
```
$ python
>>> from quilt.data.examples import wine
```
The import syntax is `from quilt.data.USER import PACKAGE`.

Let's see what's in the `wine` package:
```
>>> wine
<class 'quilt.data.DataNode'>
File: /Users/kmoore/toa/github/quilt2/quilt_packages/examples/wine.json
Path: /
README/
quality/
>>> wine.quality
<class 'quilt.data.DataNode'>
File: /Users/kmoore/toa/github/quilt2/quilt_packages/examples/wine.json
Path: /quality/
red/
white/
>>> type(wine.quality.red)
<class 'pandas.core.frame.DataFrame'>
>>> wine.quality.red
      fixed acidity  volatile acidity  citric acid  residual sugar  chlorides  \
0               7.4             0.700         0.00             1.9      0.076   
1               7.8             0.880         0.00             2.6      0.098   
2               7.8             0.760         0.04             2.3      0.092   
...
[1599 rows x 12 columns]
```

## Create your first package
The simplest way to create a data package is from a set of input files. Quilt's `build` command can take a source file directory as a parameter and automatically build a package based on its contents.
```
quilt build USER/PACKAGE -d PATH_TO_INPUT_FILES
```
That will create a data package USER/PACKAGE on your local machine. You can inspect the contents using:
```
quilt inspect USER/PACKAGE
```

You can now use your package locally:
```python
from quilt.data.USER import PACKAGE
```
Data packages deserialize 5x to 20x faster than text files.

## Customize package contents by editing build.yml 
Running `quilt build USER/PACKAGE -d PATH` as described above generates a data package and a file, `build.yml` that specifies the contents of the package.

Your file should look something like this:
```yaml
---
tables:
  one: [csv, src/bar/your.txt]
  two: [csv, another.csv]
  um:
    buckle: [xls, finance/excel_file.xls]
    my: [xlsx, numbers/excel_file.xlsx]
    shoe: [tsv, measurements.txt]
...
```
The above `build.yml` tells `quilt` how to build a package from a set of input files. By editing the automatically generated build.yml or creating a configuration file of your own, you can control the exact names of DataFrames and files in your package.

The tree structures under `tables` and `files` dictate the package tree. `foo.one` and `foo.two` will import as data frames. `foo.um` is a group containing three data frames. `foo.um.buckle` is a data frame, etc.

### DataFrames/Tables
Each leaf node in `tables` is specified by a list of the form
`[parser, file]`. You can have as many leaf nodes (data frames) and non-leaf nodes (groups) as you choose.

**Note**: `parser` and `file`'s extension may differ, and in
practice often do. For example `foo.one` uses the `csv`
parser to read from a `.txt` file that, contrary to its extension, is actually
in CSV format. The separation of `parser` and `file` allows you to change
parsers without changing file names.

### Supported parsers
- `xls` or `xlsx` for Excel
- `csv` for comma-separated values
- `tsv` for tab-separated values
- `ssv` for semicolon-separated values

`quilt` can be extended to support more parsers. See `TARGET` in `quilt/data/tools/constants.py`.

### Raw files
Packages can include data and other contents that are not representable as DataFrames. The `files` tree in build.yml maps names to raw input files. Those files will be included in the data package unmodified.

Files can be accessed by using the normal Python `open` method.
```python
from quilt.data.USER import PACKAGE
with open(PACKAGE.a_file, 'r') as localfile:
  print(localfile.read())
```

### Build the package using the build file
- `quilt build USER/PACKAGE build.yml`

`build` parses the source files referenced in the `tables` tree of `build.yml`, transforms them with specified parser into data frames, then serializes the data frames to memory-mapped binary formats. At present quilt packages are pandas data frames stored in HDF5. In the future we will support R, Spark, and
binary formats like Parquet.


### Push the package
So far your package lives on your local machine. Now you can
push it to a secure registry in the cloud.

1. `quilt login`. Sign in or create an account, then paste your confirmation code into
`quilt`.

1. `quilt push YOU/YOUR_PACKAGE` adds your package to the registry. By default all
packages are private to the owner (you).

**Note**: all packages are private by default, visible only to the owner. 

### Manage access
- `quilt access add YOU/YOUR_PACKAGE FRIEND`. Now user `FRIEND` can
`quilt install YOU/YOUR_PACKAGE`. In the near future
the quilt registry at [quiltdata.com](https://quiltdata.com) will offer
a graphical user interface for easy access control.

If you wish to make a package public, `quilt access add YOU/YOUR_PACKAGE public`.

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

## If you need h5py
### The easy way with binaries
Use conda to `conda install h5py`.

### The hard way from source (YMMV; this is for Mac OS)
1. Install HDF5: `brew install homebrew/science/hdf5@1.8`
  - [See also this `h5py` doc](http://docs.h5py.org/en/latest/build.html#source-installation-on-linux-and-os-x)
1. Expose compiler flags in `~/.bash_profile`. Follow the homebrew instructions, which should look something like this:
```
export LDFLAGS="-L/usr/local/opt/hdf5@1.8/lib"
export CPPFLAGS="-I/usr/local/opt/hdf5@1.8/include"
```
