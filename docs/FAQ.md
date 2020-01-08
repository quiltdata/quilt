## How does Quilt versioning relate to S3 object versioning?
Quilt packages are one level of abstraction above S3 object versions.
Object versions track mutations to a single file,
whereas a quilt package may reference one or more files and makes this entire collection of files reproducible.

It is strongly recommended that you enable object versioning on the S3 buckets
that you push Quilt packages to.
Object versioning ensures that mutations to every object are tracked,
and provides some protection against deletion.

## Where are the Quilt 2 packages?
Visit [legacy.quiltdata.com](https://legacy.quiltdata.com/)
and use [`quilt`](https://pypi.org/project/quilt/) on PyPI.

## Does `quilt3` collect anonymous usage statistics?
Yes, to find bugs and prioritize features.

You can disable anonymous usage collection with an environment variable:
```
$ export QUILT_DISABLE_USAGE_METRICS=true
```

Or call `quilt3.disable_telemetry()`
to persistently disable anonymous usage statistics.
