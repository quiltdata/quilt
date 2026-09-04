<!--pytest-codeblocks:skipfile-->
<!-- markdownlint-disable -->
Once your package is ready it's time to save and distribute it.

## Saving a package manifest locally

To save a package to your local disk use `build`.


```python
import quilt3
p = quilt3.Package()

top_hash = p.build("aneesh/test_data")
```

Building a package requires providing it with a name. Package names must follow the `"${namespace}/${packagename}"` format. For small teams, we recommend using the package author's name as the namespace.

## Authenticating to a remote registry

To share a package with others via a remote registry you will first need to authenticate against it, if you haven't done so already:

```python
# only need to run this once
# ie quilt3.config('https://your-catalog-homepage/')
quilt3.config('https://open.quiltdata.com/')

# follow the instructions to finish login
quilt3.login()
```

## Pushing a package to a remote registry

To share a package with others via a remote registry, use `push`:

```python
p = quilt3.Package()
p.push(
    "aneesh/test_data",
    "s3://quilt-example",
    message="Updated version of my package"
)
```

`s3://quilt-example` is the *registry*&mdash;the storage backend that the package is available from.

You can omit the registry argument if you configure a `default_remote_registry` (this setting persists between sessions):

```python
quilt3.config(default_remote_registry='s3://quilt-example')
p = quilt3.Package()
p.push("aneesh/test_data")
```

You can control where files land using `dest`:

```python
p = quilt3.Package()
p.push(
    "aneesh/test_data",
    dest="s3://quilt-example/foo/bar"
)
```

>For even more fine-grained control of object landing paths see [Materialization](../advanced-features/materialization.md).

## Pushing again: revision conflicts

`push` will not overwrite a package revision it does not descend from. A push succeeds only if the destination has no revision yet, or its latest revision is one your in-memory package "knows about" &mdash; i.e. it was obtained via `Package.browse()` or returned by a previous `push`. Otherwise `push` raises `QuiltConflictException`. This protects two writers from silently clobbering each other's revisions.

The recommended pattern for updating an existing package is browse-then-push:

```python
p = quilt3.Package.browse("aneesh/test_data", "s3://quilt-example")
p.set("new_file.csv", "new_file.csv")
p.push("aneesh/test_data", "s3://quilt-example", message="Add new_file.csv")
```

Two keyword arguments modify this behavior:

* `force=True` skips the conflict check and overwrites the latest revision (CLI: `quilt3 push --force`).
* `dedupe=True` skips the push entirely if the package content is identical to the latest revision at the destination.

## Saving a package on a remote registry

`push` will send both a package manifest and its data to a remote registry. This will involve copying your data to S3. To save just the package manifest to S3 without any data copying, use `build`:

```python
p = quilt3.Package()
p.build("aneesh/test_data", "s3://quilt-example")
```

This will create a new version of your package with all of its physical keys preserved.

## Delete a package from a registry

To delete a package from a registry:

```python
# delete a package in the local registry
quilt3.delete_package("aneesh/test_data")

# delete a package in a remote registry
quilt3.delete_package("aneesh/test_data", "s3://quilt-example")
```

Note that this will not delete any package data, only the package manifest.
