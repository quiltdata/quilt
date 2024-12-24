<!--pytest-codeblocks:skipfile-->
<!-- markdownlint-disable -->

## Materialization

`push` uploads the entries in a data package to a remote registry,
performs the tophash calculations, and stores a package manifest
referencing the remote files in the remote registry.

This is known as **materialization**,
and it means that `push` creates **materialized packages**: packages
which point solely to files located in an Amazon S3 bucket.

## Pushing unmaterialized packages

There are advanced use cases where automatically copying (potentially
large) files is not the behavior you want.

To push an _unmaterialized_ file to a remote registry, use `build`
with a `registry`. For example:

```python
import quilt3
p = quilt3.Package().set("example.csv", "example.csv")
p.build("username/packagename", registry="s3://my-bucket")
```

Note that in this case it is up to you, the package author, to
ensure that any local files in the package remain available and
accessible to users.
