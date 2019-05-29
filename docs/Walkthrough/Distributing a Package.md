Once your package is ready it's time to save and distribute it.

## Building a package locally

To save a package to your local disk use `build`.

```python
import quilt
p = quilt3.Package()

top_hash = p.build("username/packagename")
```

Building a package requires providing it with a name. Packages names must follow the `$"{namespace}/${packagename}"` format. For small teams, we recommend using the package author's name as the namespace.

## Pushing a package to a remote registry

To share a package with others via a remote registry, `push` it:

```python
import quilt
p = quilt3.Package()
p.push(
    "username/packagename",
    "s3://your-bucket",
    message="Updated version my package"
)
```

`s3://your-bucket` is the *registry*&mdash;the storage backend that the package is available from.

If you omit a registry entirely, the default remote registry will be used:

```python
import quilt
quilt3.config(default_remote_registry='s3://your-bucket')
# this now 'just works'
quilt3.Package().push("username/packagename")  
```

The default remote registry, if set, persists between sessions.

Note that by default, the contents of the package will be written into the `s3://your-bucket/username/packagename/` path. If you want the files to land someplace else, pass a more specific path:

```python
p.push(
    "username/packagename",
    "s3://your-bucket/foo/bar/"
)
# object will land in "/foo/bar/"
# instead of "/username/packagename/"
```

> For even more fine-grained control of object landing paths see [Materialization](../Advanced%20Features/Materialization.md).

## Distributing a package version

Once you build `build` or `push` a package, it has a *top_hash*:

```python
import quilt

p = quilt3.Package()
p.build("username/packagename")
p.top_hash

'2a5a67156ca9238c14d12042db51c5b52260fdd5511b61ea89b58929d6e1769b'
```

A top hash is a persistent, immutable reference to a specific version of a package. To ensure that you always download this specific version of this package in the future, provide its top hash.

## Delete a package from a registry

To delete a package from a registry:

```python
import quilt

# delete a package in the local registry
quilt3.delete_package("username/packagename")

# delete a package in a remote registry
quilt3.delete_package("username/packagename", "s3://your-bucket")
```

Only do this if you really need to as this will break the package for anyone relying on it.
