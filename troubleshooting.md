# Questions?
Chat with us via the orange icon intercom on [quiltdata.com](https://quiltdata.com). We can also invite you to our Slack channel.

# Packages missing after upgrade to Quilt 2.8
Quilt 2.8 changes where data packages are stored on your local machine. As a result, quilt will no longer look for packages in quilt_packages directories. You will need to reinstall any previously installed packages. Locally build packages can be rebuilt. Or, to migrate existing packages to the new store without rebuilding, first revert to an ealier version of quilt, then push your packages to the Quilt registry.
```bash
pip install quilt==2.7.1
quilt push <your_username>/<your_package>
``` 

Once your packages are stored at the registry, you can upgrade to quilt 2.8.0 (or later) and re-install them.
```bash
pip install --upgrade quilt
quilt install <your_username>/<your_package>
```

# `ImportError` on import of data package
Ensure that that the package has been installed via `quilt install`.

# (Windows) `ImportError` when accessing package contents
`pyarrow` module, used by `quilt`, may fail to import because of missing DLLs:
```
  File "C:\Program Files\Python36\lib\site-packages\pyarrow\__init__.py", line 32, in <module>
    from pyarrow.lib import cpu_count, set_cpu_count
ImportError: DLL load failed: The specified module could not be found.
```

Make sure you have installed [Visual C++ Redistributable for Visual Studio 2015](https://www.microsoft.com/en-us/download/details.aspx?id=48145).

# Jupyter, virtual environments, `quilt` not found
When working with virtual environments like `conda create`, `jupyter` can be installed in the `root` environment. If you then install and run `quilt` in another environment, `foo`, Jupyter will not be able to find quilt.

## Solutions
Install `quilt` in the `root` environment, or install Jupyter in `foo` (run `which jupyter` in Jupyter's Terminal to ensure that you're using the environment local Jupyter).

Alternatively, `pip install quilt` from Jupyter's Terminal.

# pandas `index_col`
This keyword argument should be temporarily avoided in `build.yml` as it causes `pyarrow` to hiccup on serialization.

# Exception when installing `quilt` on OS X El Capitan

`pip` may try to upgrade `pyOpenSSL`, and fail with the following exception when removing the old version of the package:
```
OSError: [Errno 1] Operation not permitted: '/tmp/pip-zFP4QS-uninstall/System/Library/Frameworks/Python.framework/Versions/2.7/Extras/lib/python/pyOpenSSL-0.13.1-py2.7.egg-info'
```

This problem is not specific to `quilt`, and is caused by outdated packages in OS X. See [this stackoverflow question](https://stackoverflow.com/questions/31900008/oserror-errno-1-operation-not-permitted-when-installing-scrapy-in-osx-10-11) for more information.

## Solutions
- Use a virtual environment such as [`conda`](https://conda.io/docs/installation.html) or [`virtualenvwrapper`](https://virtualenvwrapper.readthedocs.io/en/latest/)
- Upgrade `pyOpenSSL` using `brew` or `easy_install`
- Upgrade to a more recent version of OS X

# `ArrowNotImplementedError` when saving a large dataframe

Unfortunately, this is caused by a [bug in pyarrow](https://github.com/apache/arrow/issues/1300).

There does not appear to be a way to save a dataframe with a string column whose size is over 2GB. It is possible, however, to split it up into multiple dataframes - which will then get merged into one when accessed.

## Workaround

Suppose the problematic dataframe is called `big_data`, it comes from `big_data.csv`, and the root of your package is in `my_dir`.

First, delete the dataframe from the build file, `my_dir/build.yml`. (If you were building directly from a directory, then run `quilt generate my_dir` first.)

Build a temporary package that contains the rest of the data:
```
quilt build user/pkg_partial my_dir/build.yml
```

Open a Python shell or write a script, and manually build the final package:
```python
import quilt
import pandas as pd
from quilt.data.user import pkg_partial

# Read the dataframe.
data = pd.read_csv('my_dir/big_data.csv')

# Add it to the partial package.
# You will need to adjust the number of pieces and number of rows per piece
pkg_partial._set(['big_data', 'part1'], data[0:1500000])
pkg_partial._set(['big_data', 'part2'], data[1500000:])

# Build the final package.
quilt.build('user/pkg', pkg_partial)

# Import the new package.
from quilt.data.user import pkg

# Get a merged dataframe. You can also access pkg.big_data.part1(), etc. if needed.
new_data = pkg.big_data()

# Make sure the dataframe in the package is in fact the same as the original.
assert new_data.equals(data)
```

***