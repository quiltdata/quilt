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

# Installation
## Mac / Windows
1. Install [Conda](https://conda.io/docs/install/quick.html)
1. `conda install -c conda-forge pyarrow=0.4`
1. `pip install quilt`

## Linux
1. Install the OpenSSL headers:
   * Ubuntu: `sudo apt-get install libssl-dev`
   * Fedora: `sudo dnf install openssl-devel`
1. `pip install quilt`

# Learn
* [Video demo](https://youtu.be/tLdiDqtnnho)
* [Tutorial on data packages](https://blog.ycombinator.com/data-packages-for-fast-reproducible-python-analysis/)
* [Why package data?](https://blog.quiltdata.com/its-time-to-manage-data-like-source-code-3df04cd312b8)

# Future
Quilt currently supports Python. Spark and R support are in the works.

# Questions?
Chat with us on  [quiltdata.com](https://quiltdata.com/). 

# Command summary
You can use Quilt on the command line or directly in Python. Both interfaces have the same singature.
So `$ quilt install foo/bar build.yml` is equivalent to `quilt.install("foo/bar", "build.yml")`.

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

# Supported Python versions
* 2.7
* ~~3.2~~
* ~~3.3~~
* 3.4
* 3.5
* 3.6

# Build recipes
* [VCF (and other custom file formats)](https://quiltdata.com/package/akarve/vcf)

# `build.yml` structure and options
See the [Tutorial](https://blog.ycombinator.com/data-packages-for-fast-reproducible-python-analysis/) for details on `build.yml`.
``` yaml
contents:
  GROUP_NAME:
    DATA_NAME:
      file: PATH_TO_FILE
      transform: {id, csv, tsv, ssv, xls, xlsx}
      sep: "\t" # tab separated values
      # or any key-word argument to pandas.read_csv (http://pandas.pydata.org/pandas-docs/stable/generated/pandas.read_csv.html)
```

## Column types
Supported Pandas column types (via dtype):
* int
* bool
* float
* complex
* str
* unicode
* buffer

Everything else becomes type object. See [dtypes](https://docs.scipy.org/doc/numpy/reference/arrays.dtypes.html).

# Package editing

In addition to building a new package from source data, Quilt allows editing of an existing package. You can then save changes back to the original package or build a new one.

Start by installing and importing the package:
``` python
import quilt
quilt.install("akarve/wine")
from quilt.data.akarve import wine
```

Use the Pandas API to edit existing dataframes:
``` python
red_df = wine.quality.red._data()
red_df.set_value(0, 'quality', 6)
```
(The `_data()` method caches the dataframe so it will return the same object each time - however, it's not saved to disk yet.)

Use the standard Python syntax to create or delete attributes:
``` python
wine.quality.red2 = wine.quality.red
del wine.quality.red
```

Use the `_set` helper method on the top-level package node to create new groups and data nodes:
``` python
import pandas as pd
df = pd.DataFrame(dict(x=[1, 2, 3]))
wine._set(["group", "df"], df)
assert wine.group.df._data() is df
```

Now, build a modified package to save all of the changes:
``` python
quilt.build("my_user/wine_modified", wine)
```

# Data Groups
Quilt supports accessing data packages at different granularities when there are groups of DataFrames with matching schemas. Calling `_data()` on a group node returns a DataFrame with the union of all the member DataFrames.
```yaml
contents:
  sales2017:
    jan:
      file:
        sales_jan_2017.csv
    feb:
      file:
        sales_feb_2017.csv
    mar:
      file:
        sales_mar_2017.csv
```
``` python
    sales2017.jan._data() # Sales data from January 2017
    sales2017._data()     # Sales data from January-March 2017
```

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
