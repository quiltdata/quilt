## Environment variables
### `QUILT_DISABLE_USAGE_METRICS`
Disable anonymous usage collection. Defaults to `False`
```
$ export QUILT_DISABLE_USAGE_METRICS=true
```
### `QUILT_MINIMIZE_STDOUT`
Turn off TQDM progress bars for log files. Defaults to `False`
```
$ export QUILT_MINIMIZE_STDOUT=true
```

### `XDG_*`
Quilt uses appdirs for Python to determine where to write data. You can therefore
override the following path constants with environment variables using the XDG
standard (see [appdirs docs](https://pypi.org/project/appdirs/)).

For instance, AWS Lambda, requires the user to use `tmp/*` as the scratch
directory. You can override `quilt3.utils.CACHE_PATH`, so that `quilt3 install` will succeed
in Lambda, by setting the `XDG_CACHE_HOME` environment variable.


## Constants (see [util.py](https://github.com/quiltdata/quilt/blob/master/api/python/quilt3/util.py) for more)

- `APP_NAME`
- `APP_AUTHOR`
- `BASE_DIR` - Base directory of the application
- `BASE_PATH` - Base pathlib path for the application directory
- `CACHE_PATH` - Pathlib path for the user cache directory
- `TEMPFILE_DIR_PATH` - Base pathlib path for the application `tempfiles`
- `CONFIG_PATH` - Base pathlib path for the application configuration file
- `OPEN_DATA_URL` - Application data url
- `PACKAGE_NAME_FORMAT` - Regex for legal package names
