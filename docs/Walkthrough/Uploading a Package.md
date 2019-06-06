Once your package is ready it's time to save and distribute it.

## Saving a package manifest locally

To save a package to your local disk use `build`.

```python
import quilt3
p = quilt3.Package()

top_hash = p.build("username/packagename")
```

Building a package requires providing it with a name. Packages names must follow the `$"{namespace}/${packagename}"` format. For small teams, we recommend using the package author's name as the namespace.

## Authenticating to a remote registry

To share a package with others via a remote registry you will first need to authenticate against, if you haven't done so already:

```python
import quilt3

# only need to run this once
quilt3.config('https://your-catalog-homepage/')

# follow the instructions to finish login
quilt3.login()
```

## Pushing a package to a remote registry

To share a package with others via a remote registry, use `push`:

```python
import quilt3
p = quilt3.Package()
p.push(
    "username/packagename",
    "s3://your-bucket",
    message="Updated version my package"
)
```

`s3://your-bucket` is the *registry*&mdash;the storage backend that the package is available from.

You can omit the registry argument if you configure a `default_remote_registry` (this setting persists between sessions):

```python
import quilt3
quilt3.config(default_remote_registry='s3://your-bucket')
p = quilt3.Package()
p.push("username/packagename")  
```

You can control where files land using `dest`:

```python
p = quilt3.Package()
p.push(
    "username/packagename",
    dest="s3://your-bucket/foo/bar"
)
```

> For even more fine-grained control of object landing paths see [Materialization](../Advanced%20Features/Materialization.md).

## Saving a package on a remote registry

`push` will send both a package manifest and its data to a remote registry. This will involve copying your data to S3. To save just the package manifest to S3 without any data copying, use `build`:

```python
p = quilt3.Package()
p.build("username/packagename", "s3://your-bucket")
```

This will create a new version of your package with all of its physical keys preserved.

## Delete a package from a registry

To delete a package from a registry:

```python
import quilt3

# delete a package in the local registry
quilt3.delete_package("username/packagename")

# delete a package in a remote registry
quilt3.delete_package("username/packagename", "s3://your-bucket")
```

Note that this will not delete any package data, only the package manifest.
