# This is alpha software
It will eventually be awesome. Until then we welcome your contributions.
If you hit any snags or want to chat, please find us via
the little orange chat icon on [beta.quiltdata.com](https://beta.quiltdata.com/).

We're three engineers with a strong commitment to quality but a long list of things
to do :)

# Overview
[Quilt](https://beta.quiltdata.com/) is a data package manager.
You can use data packages from the community, or publish packages for others to use.

`quilt` is the command-line client that builds, retrieves, and stores
packages. `quilt` works in conjunction with a server-side registry,
not covered in this document. `quilt` currently pushes to and pulls from
the registry at [beta.quiltdata.com](https://beta.quiltdata.com/). In the near
future users will be able to browse packages in the registry.

## Benefits
* Access data frames [5X to 20X faster](http://wesmckinney.com/blog/pandas-and-apache-arrow/).
Quilt stores data frames in high-efficiency, memory-mapped binary formats like HDF5.
* Version your data. Pull packages by version number or tag (incomplete feature).
* Publish data packages for the benefit of the community.
* Satisfy your data dependencies with one command, `quilt install dependency`.

# Known Issues
* Installation under Python 3.6 tends to fail on missing HDF5 dependencies. Try Python 3.5. For example if you're using Anaconda, here's how you create a 3.5 environment: `conda create -n ENV python=3.5`.

# Quick Start
1. Open Terminal
1. `$ pip install git+https://github.com/quiltdata/quilt.git` (install quilt)
1. `$ quilt install akarve/wine` (install a sample package)
1. `python` (fire up python)
1. You've got data frames
```
>>> from quilt.data.akarve import wine
>>> wine.quality.red # this is a pandas.DataFrame
```

# Tutorial

## Install `quilt`
- `pip install quilt`

## Install a package
Let's install a public package containing wine quality data from the UCI Machine
Learning Repository.
- `quilt install akarve/wine`

Now let's fire up Python and import the package.
```
$ python
>>> from quilt.data.akarve import wine
```
The import syntax is `from quilt.data.USER import PACKAGE`.

Let's see what's in the `wine` package:
```
>>> wine
<class 'quilt.data.Node'>
File: /Users/karve/code/quilt-cli/quilt_packages/akarve/wine.h5
Path: /
quality/
>>> wine.quality
<class 'quilt.data.Node'>
File: /Users/karve/code/quilt-cli/quilt_packages/akarve/wine.h5
Path: /quality/
red/
white/
>>> wine.quality.red
# ... omitting lots of rows
1598     11.0        6  

[1599 rows x 12 columns]
>>> type(wine.quality.red)
<class 'pandas.core.frame.DataFrame'>
>>> type(wine.quality)
<class 'quilt.data.Node'>
```
As you can see, `quilt` packages are a tree of groups and data frames.
You can enumerate a package tree as follows:
```
>>> wine.quality._keys()
dict_keys(['red', 'white'])
>>> wine.quality._groups()
[]
>>> wine.quality._dfs()
['red', 'white']
```

### Traverse a package

`foo._keys()` enumerates all children of `foo`, whereas `foo._dfs()` and
`foo._groups()` partition keys into data frames and groups, respectively.
Groups are like folders for data frames.

## Create your first package
Create a `build.yml` file. Your file should look something like this:
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
The above `build.yml` tells `quilt` how to build a package from a set
of input files. The `tables` dictionary is required. The tree
structure under `tables` dictates the package tree. `foo.one` and
`foo.two` will import as data frames. `foo.um` is a group containing
three data frames. `foo.um.buckle` is a data frame, etc.

Each leaf node in `tables` is specified by a list of the form
`[parser, file]`. You can have as many leaf nodes (data frames) and non-leaf nodes
(groups) as you choose.

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

### Build the package
- `quilt build USER/PACKAGE build.yml`

`build` parses the files referenced in `data.yml`, transforms them with specified
parser into data frames, then serializes the data frames to
memory-mapped binary formats. At present quilt packages are pandas
data frames stored in HDF5. In the future we will support R, Spark, and
binary formats like Parquet.

You can now use your package locally:
```
>>> from quilt.data.user import package
```
Data packages deserialize 5x to 20x faster than text files.

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
the quilt registry at [beta.quiltdata.com](https://quiltdata.com) will offer
a graphical user interface for easy access control.

If you wish to make a package public, `quilt access add YOU/YOUR_PACKAGE public`.

# Command summary
* `quilt -h` for a list of commands
* `quilt CMD -h` for info about a command
* `quilt login`
* `quilt build USER/PACKAGE FILE.YML`
* `quilt push USER/PACKAGE` stores the package in the registry
* `quilt access list USER/PACKAGE` to see who has access to a package
* `quilt access {add, remove} USER/PACKAGE ANOTHER_USER` to set access

# Developer
- `pip install pylint pytest`
- `pytest` will run any `test_*` files in any subdirectory
- All new modules, files, and functions should have a corresponding test

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
