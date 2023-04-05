## Environment variables

### `QUILT_DISABLE_CACHE`
Turn off cache. Defaults to `False`.
```
$ export QUILT_DISABLE_CACHE=true
```

### `QUILT_DISABLE_USAGE_METRICS`
Disable anonymous usage collection. Defaults to `False`
```
$ export QUILT_DISABLE_USAGE_METRICS=true
```

### `QUILT_MANIFEST_MAX_RECORD_SIZE`
Maximum size of a record in package manifest. **Setting this variable is strongly discouraged.**
Defaults to `1_000_000`.

### `QUILT_MINIMIZE_STDOUT`
Turn off TQDM progress bars for log files. Defaults to `False`
```
$ export QUILT_MINIMIZE_STDOUT=true
```

### `QUILT_TRANSFER_MAX_CONCURRENCY`
Number of threads for file transfers. Defaults to `10`.

This variable could be tried for improving file transfer rate. The optimal value
depends on network bandwidth, CPU performance, file sizes, etc.
```
$ export QUILT_TRANSFER_MAX_CONCURRENCY=20
```

### `XDG_*`
`quilt3` uses platformdirs so you can set one or more of the
[XDG environment variables](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
to customize where `quilt3` writes to disk.

For example, AWS Lambda requires the user to use `/tmp/*` as the scratch
directory. You can override `quilt3.util.CACHE_PATH`, so that `quilt3 install` 
will succeed, by setting the `XDG_CACHE_HOME` environment variable in code or in
your [AWS Lambda environment variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html).

> You must **set XDG environment variables before** `import quilt3` in
order for them to take effect.

## Constants (see [util.py](https://github.com/quiltdata/quilt/blob/master/api/python/quilt3/util.py) for more)

- `APP_AUTHOR`
- `APP_NAME`
- `BASE_DIR` - Base directory of the application
- `BASE_PATH` - Base pathlib path for the application directory
- `CACHE_PATH` - Pathlib path for the user cache directory
- `CONFIG_PATH` - Base pathlib path for the application configuration file
- `OPEN_DATA_URL` - Application data url
- `PACKAGE_NAME_FORMAT` - Regex for legal package names
- `TEMPFILE_DIR_PATH` - Base pathlib path for the application `tempfiles`
