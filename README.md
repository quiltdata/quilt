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
-  `quilt/test/build.yml` relies on pickle and is therefore not compatible between Python 2 and Python 3.

# Quick Start
1. Open Terminal
1. `$ pip install quilt`
1. `$ quilt install examples/wine` (install a sample package)
1. `$ python` (fire up python)
1. You've got data frames
```
>>> from quilt.data.examples import wine
>>> wine.quality.red # this is a pandas.DataFrame
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
<class 'quilt.data.Node'>
File: /Users/karve/code/quilt-cli/quilt_packages/examples/wine.h5
Path: /
quality/
>>> wine.quality
<class 'quilt.data.Node'>
File: /Users/karve/code/quilt-cli/quilt_packages/examples/wine.h5
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
