## `build` versus `push`

`build` and `push` have the following behaviors:

* `build` calculates a tophash based on the package entry data, package entry metadata, and top-level package metadata, injects that into the package manifest, and stores the package manifest in the local registry.
* `push` uploads the entries in the package to a remote registry, performs the same tophash calculations, and stores a package manifest referencing the remote files in the remote registry.

Under the hood, there are just two differences between `push` and `build`:

* `push` targets a remote registry; `build` targets a local registry
* `push` copies package files; `build` leaves files where they are

## Materialization

The latter of these two differences is known as **materialization**, and it means that `push` creates **materialized packages**: packages which point solely to files located in an S3 bucket.

A materialized package is stronger than a unmaterialized (or "local") package because S3 guarantees that individual object versions are never lost or destroyed (assuming object versioning is enabled). Furthermore, only materialized packages may be browsed in the online T4 catalog.

## Pushing unmaterialized packages

There are advanced use cases where automatically copying (potentially large) files is not the behavior you want.

To push an _umaterialized_ file to a remote registry, provide `build` with a `registry`. For example:

```python
import t4
p = t4.Package().set("example.csv", "example.csv")
p.build("username/packagename", registry="s3://my-bucket")
```

Note that in this case it is up to you, the package author, to ensure that any local files in the package remain available and accessible to users.