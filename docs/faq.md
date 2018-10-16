# Frequently asked questions

## Does Quilt support numpy arrays?
As of version 2.9.9, [numpy arrays are first-class objects in Quilt](https://github.com/quiltdata/examples/blob/master/Numpy%2C%20easy%20package%20edit.ipynb).

## How much data can I put into Quilt?

There no limit on public data, as shown in our [Pricing grid](https://quiltdata.com/#pricing).

In practice, users have been successful with packages at 2TB of total size
with up to 40,000 individual files.

We are constantly upping the amount of data users can put into Quilt.
Contact us if you have questions about large data.

## Where are my data stored?
* Local builds (without `quilt push`) - on your machine
* qultdata.com user - in S3; if your package is private only you can read the data
* Teams user - in a dedicated S3 bucket
* Running your own registry - up to you :-)

## How do I convert a package into files?
You can use [`quilt export`](api-cli.md#export-a-package-or-subpackage).

## How do install the latest quilt (compiler) directly from GitHub?
For developers only:
```sh
pip install git+https://github.com/quiltdata/quilt.git#subdirectory=compiler
```
See also [this SO post](https://stackoverflow.com/questions/13566200/how-can-i-install-from-a-git-subdirectory-with-pip) for further install options.

## How do I use Quilt with Google Cloud Datalab?
* Installation: `pip install quilt --user`, the User icon (upper right) > About > Restart server
* Prefer Python 3 kernels

## `quilt login` doesn't present a textbox for my login code in Jupyter
* Try a Python 3 kernel

## `ImportError` on import of data package
Ensure that that the package has been installed via `quilt install`.

## (Windows) `ImportError` when accessing package contents
`pyarrow` module, used by `quilt`, may fail to import because of missing DLLs:
```
  File "C:\Program Files\Python36\lib\site-packages\pyarrow\__init__.py", line 32, in <module>
    from pyarrow.lib import cpu_count, set_cpu_count
ImportError: DLL load failed: The specified module could not be found.
```
Make sure you have installed [Visual C++ Redistributable for Visual Studio 2015](https://www.microsoft.com/en-us/download/details.aspx?id=48145).

## `!pip install quilt` in Jupyter doesn't work
Installing packages inside of Python kernels can be flaky. The reason?
Jupyter's Python kernels are disconnected from virtual environments.

To work around this issue, Install Quilt from Jupyter Terminal, or from
your operating system terminal.

For details, including how to make `!pip install quilt` work, see [Installing Python Packages from a Jupyter Notebook](https://jakevdp.github.io/blog/2017/12/05/installing-python-packages-from-jupyter/).

## Jupyter, virtual environments, `quilt` not found
When working with virtual environments like `conda create`, `jupyter` can be installed in the `root` environment. If you then install and run `quilt` in another environment, `foo`, Jupyter will not be able to find quilt.

### Solutions
Install `quilt` in the `root` environment, or install Jupyter in `foo`
(run `which jupyter` in Jupyter's Terminal to ensure that you're using the
environment local Jupyter).

Alternatively, `pip install quilt` from Jupyter's Terminal.

## Avoid pandas `index_col`
This keyword argument should be temporarily avoided in `build.yml` as it causes
`pyarrow` to hiccup on serialization.

## Packages missing after upgrade to Quilt 2.8
Quilt 2.8 changes where data packages are stored on your local machine.

As a result, Quilt will no longer look for packages in quilt_packages directories.
You will need to reinstall any previously installed packages.
Locally built packages can be rebuilt.
Or, to migrate existing packages to the new store without rebuilding, first revert
to an earlier version of Quilt, then push your packages to the Quilt registry.

```bash
pip install quilt==2.7.1
quilt push <your_username>/<your_package>
``` 

Once your packages are stored at the registry, you can upgrade to quilt 2.8.0
(or later) and re-install them.

```bash
pip install --upgrade quilt
quilt install <your_username>/<your_package>
```

## `ArrowNotImplementedError` when saving a large dataframe

Unfortunately, this is caused by a [bug in pyarrow](https://github.com/apache/arrow/issues/1300).

There does not appear to be a way to save a dataframe with a string column whose
size is over 2GB. It is possible, however, to split it up into multiple dataframes
(which will then get merged into one when accessed).

### Workaround

Suppose the problematic dataframe is called `big_data`, it comes from `big_data.csv`,
and the root of your package is in `my_dir`.

First, delete the dataframe from the build file, `my_dir/build.yml`.
(If you were building directly from a directory, then run `quilt generate my_dir` first.)

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

## Exporting to symbolic links on Windows doesn't work

Symbolic links on Windows have a few quirks to be aware of.

* Ensure Windows is fully updated (known related bugs exist)
* Escalate administrator privileges ("run as admin"), or validate user privileges
  * See [this SuperUser article](https://superuser.com/questions/104845/permission-to-make-symbolic-links-in-windows-7/105381#105381) for relevant instructions
  * If UAC is on
    * If user __is not__ an administrator, they must have the `Create Symbolic Links` privilege
    * If user __is__ an administrator, they must escalate privileges, even if they have the `Create Symbolic Links` privilege
      * This means if you want a user to create symlinks without requiring escalation, they may not be an administrator.
  * If UAC is off
    * Any user with the `Create Symbolic Links` privilege may do so
* Folder-level privileges may interfere with symlinking
  * Verify there are no folder-specific restrictions on privileges
* Symlink type may be disabled, as it is by default for remote->remote symlinks
  * Use `fsutil` (from an elevated command prompt) to evaluate and/or enable acceptable symlink types
    * `fsutil`: *For advanced users only.*  See the [Microsoft documentation on fsutil](https://docs.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-R2-and-2012/cc753059(v=ws.11))
      * `fsutil behavior query SymlinkEvaluation` will display the current state of symlink evaluation
      * Use `fsutil behavior set SymlinkEvaluation R2R:1` to enable (for example) remote-to-remote symlinks
      
      
 ## `Segmentation fault (core dumped)`
 Seen on Ubuntu 18.04, Google Cloud Platform.
 
 ### Solution
 `sudo pip install quilt # ¯\_(ツ)_/¯`

## `TypeError: data type "mixed-integer" not understood` when reading a DataFrame from a package
This error occurs when trying to round-trip Pandas DataFrames that have a column name that is a number to Parquet using Arrow 0.9. This can occur during `quilt build` for package nodes built using the Pandas "skiprows" parameter in read_csv or read_excel to skip a source file's header row (usually row 0). For example, this build.yml file, skips the header row in source.xlsx:
```yaml
    foo:
        file: source.xlsx
        kwargs:
            skiprows: [0,...]
            names: ['column0',...]
```


# Advanced

## How do I use quilt on a remote machine without having to `quilt.login`?

You can copy your login session to a remote machine. Your session is stored in a file called `auth.json` in your local settings directory. If you copy it to the proper location on your remote machine, it will be as if you had logged in from that machine.

The local settings directory is different for every system. Please refer to [this](https://pypi.org/project/appdirs/) documentation for the `appdirs` package to see where it lives on your system. For example, on Linux, the path to `auth.json` should be `~/.local/share/QuiltCli/auth.json`.

You can find your local settings directory on any machine that has `quilt` installed by running this Python snippet:
```
import appdirs
appdirs.user_data_dir('QuiltCli')
```
