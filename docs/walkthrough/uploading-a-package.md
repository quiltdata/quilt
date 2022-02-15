Once your package is ready it's time to save and distribute it.

## Authentication

To push a Quilt package you need to either
[configure your local AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html#cli-configure-quickstart-config)
with read/write access to the bucket you wish to push to,
or if your company runs a Quilt stack you must log in:

*Registries* are simply S3 buckets where pacakge data and metadata are stored.

```python
# only need to run this once
quilt3.config('https://your-catalog-homepage/')

# if and only if your company runs a Quilt stack and you don't have local AWS credentials:
quilt3.login()
```

## Pushing a package to a remote registry

### New packages

To share a package with others via a remote registry, use `push`:

```python
p = quilt3.Package()
p.push(
    "aneesh/test_data",
    "s3://quilt-example",
    message="Updated version my package"
)
```

### Modifying existing packages

To modify an existing package, be sure to call `.browse` first.

```python
p = quilt3.Package.browse("existing/package", registry="s3://my-bucket")
# perform local modifications like p.set()
# ...
p.push(
    "aneesh/test_data",
    "s3://quilt-example",
    message="Updated version my package"
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

## Delete a package from a registry

To delete a package from a registry:

```python
# delete a package in the local registry
quilt3.delete_package("aneesh/test_data")

# delete a package in a remote registry
quilt3.delete_package("aneesh/test_data", "s3://quilt-example")
```

Note that this will not delete any package data, only the package manifest.

## Advanced - local packages and manifests

### Saving a package manifest locally

To save a package to your local disk use `build`.


```python
import quilt3
p = quilt3.Package()

top_hash = p.build("aneesh/test_data")
```

Building a package requires providing it with a name. Packages names must follow the `"${namespace}/${packagename}"` format. For small teams, we recommend using the package author's name as the namespace.

### Saving a package on a remote registry

`push` will send both a package manifest and its data to a remote registry. This will involve copying your data to S3. To save just the package manifest to S3 without any data copying, use `build`:

```python
p = quilt3.Package()
p.build("aneesh/test_data", "s3://quilt-example")
```

This will create a new version of your package with all of its physical keys preserved.
