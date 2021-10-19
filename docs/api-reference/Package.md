
# Package(self)  {#Package}
In-memory representation of a package

## manifest

Provides a generator of the dicts that make up the serialized package.


## top_hash

Returns the top hash of the package.

Note that physical keys are not hashed because the package has
    the same semantics regardless of where the bytes come from.

__Returns__

A string that represents the top hash of the package


## Package.\_\_repr\_\_(self, max\_lines=20)  {#Package.\_\_repr\_\_}

String representation of the Package.


## Package.install(name, registry=None, top\_hash=None, dest=None, dest\_registry=None, \*, path=None)  {#Package.install}

Installs a named package to the local registry and downloads its files.

__Arguments__

* __name(str)__:  Name of package to install. It also can be passed as NAME/PATH
    (/PATH is deprecated, use the `path` parameter instead),
    in this case only the sub-package or the entry specified by PATH will
    be downloaded.
* __registry(str)__:  Registry where package is located.
    Defaults to the default remote registry.
* __top_hash(str)__:  Hash of package to install. Defaults to latest.
* __dest(str)__:  Local path to download files to.
* __dest_registry(str)__:  Registry to install package to. Defaults to local registry.
* __path(str)__:  If specified, downloads only `path` or its children.


## Package.resolve\_hash(name, registry, hash\_prefix)  {#Package.resolve\_hash}

Find a hash that starts with a given prefix.

__Arguments__

* __name (str)__:  name of package
* __registry (str)__:  location of registry
* __hash_prefix (str)__:  hash prefix with length between 6 and 64 characters


## Package.browse(name, registry=None, top\_hash=None)  {#Package.browse}

Load a package into memory from a registry without making a local copy of
the manifest.

__Arguments__

* __name(string)__:  name of package to load
* __registry(string)__:  location of registry to load package from
* __top_hash(string)__:  top hash of package version to load


## Package.\_\_contains\_\_(self, logical\_key)  {#Package.\_\_contains\_\_}

Checks whether the package contains a specified logical_key.

__Returns__

True or False


## Package.\_\_getitem\_\_(self, logical\_key)  {#Package.\_\_getitem\_\_}

Filters the package based on prefix, and returns either a new Package
    or a PackageEntry.

__Arguments__

* __prefix(str)__:  prefix to filter on

__Returns__

PackageEntry if prefix matches a logical_key exactly
otherwise Package


## Package.fetch(self, dest='./')  {#Package.fetch}

Copy all descendants to `dest`. Descendants are written under their logical
names _relative_ to self.

__Arguments__

* __dest__:  where to put the files (locally)

__Returns__

A new Package object with entries from self, but with physical keys
    pointing to files in `dest`.


## Package.keys(self)  {#Package.keys}

Returns logical keys in the package.


## Package.walk(self)  {#Package.walk}

Generator that traverses all entries in the package tree and returns tuples of (key, entry),
with keys in alphabetical order.


## Package.load(readable\_file)  {#Package.load}

Loads a package from a readable file-like object.

__Arguments__

* __readable_file__:  readable file-like object to deserialize package from

__Returns__

A new Package object

__Raises__

file not found
json decode error
invalid package exception


## Package.set\_dir(self, lkey, path=None, meta=None, update\_policy='incoming')  {#Package.set\_dir}

Adds all files from `path` to the package.

Recursively enumerates every file in `path`, and adds them to
    the package according to their relative location to `path`.

__Arguments__

* __lkey(string)__:  prefix to add to every logical key,
    use '/' for the root of the package.
* __path(string)__:  path to scan for files to add to package.
    If None, lkey will be substituted in as the path.
* __meta(dict)__:  user level metadata dict to attach to lkey directory entry.
* __update_policy(str)__:  can be either 'incoming' (default) or 'existing'.
    If 'incoming', whenever logical keys match, always take the new entry from set_dir.
    If 'existing', whenever logical keys match, retain existing entries
    and ignore new entries from set_dir.

__Returns__

self

__Raises__

* `PackageException`:  When `path` doesn't exist.
* `ValueError`:  When `update_policy` is invalid.


## Package.get(self, logical\_key)  {#Package.get}

Gets object from logical_key and returns its physical path.
Equivalent to self[logical_key].get().

__Arguments__

* __logical_key(string)__:  logical key of the object to get

__Returns__

Physical path as a string.

__Raises__

* `KeyError`:  when logical_key is not present in the package
* `ValueError`:  if the logical_key points to a Package rather than PackageEntry.


## Package.readme(self)  {#Package.readme}

Returns the README PackageEntry

The README is the entry with the logical key 'README.md' (case-sensitive). Will raise a QuiltException if
no such entry exists.


## Package.set\_meta(self, meta)  {#Package.set\_meta}

Sets user metadata on this Package.


## Package.build(self, name, registry=None, message=None, \*, workflow=Ellipsis)  {#Package.build}

Serializes this package to a registry.

__Arguments__

* __name__:  optional name for package
* __registry__:  registry to build to
    defaults to local registry
* __message__:  the commit message of the package
* __workflow__:  workflow ID or `None` to skip workflow validation.
    If not specified, the default workflow will be used.
* __For details see__:  https://docs.quiltdata.com/advanced-usage/workflows


__Returns__

The top hash as a string.


## Package.dump(self, writable\_file)  {#Package.dump}

Serializes this package to a writable file-like object.

__Arguments__

* __writable_file__:  file-like object to write serialized package.

__Returns__

None

__Raises__

fail to create file
fail to finish write


## Package.set(self, logical\_key, entry=None, meta=None, serialization\_location=None, serialization\_format\_opts=None)  {#Package.set}

Returns self with the object at logical_key set to entry.

__Arguments__

* __logical_key(string)__:  logical key to update
* __entry(PackageEntry OR string OR object)__:  new entry to place at logical_key in the package.
    If entry is a string, it is treated as a URL, and an entry is created based on it.
    If entry is None, the logical key string will be substituted as the entry value.
    If entry is an object and quilt knows how to serialize it, it will immediately be serialized and
    written to disk, either to serialization_location or to a location managed by quilt. List of types that
    Quilt can serialize is available by calling `quilt3.formats.FormatRegistry.all_supported_formats()`
* __meta(dict)__:  user level metadata dict to attach to entry
* __serialization_format_opts(dict)__:  Optional. If passed in, only used if entry is an object. Options to help
    Quilt understand how the object should be serialized. Useful for underspecified file formats like csv
    when content contains confusing characters. Will be passed as kwargs to the FormatHandler.serialize()
    function. See docstrings for individual FormatHandlers for full list of options -
* __https__: //github.com/quiltdata/quilt/blob/master/api/python/quilt3/formats.py
* __serialization_location(string)__:  Optional. If passed in, only used if entry is an object. Where the
    serialized object should be written, e.g. "./mydataframe.parquet"

__Returns__

self


## Package.delete(self, logical\_key)  {#Package.delete}

Returns the package with logical_key removed.

__Returns__

self

__Raises__

* `KeyError`:  when logical_key is not present to be deleted


## Package.push(self, name, registry=None, dest=None, message=None, selector\_fn=None, \*, workflow=Ellipsis)  {#Package.push}

Copies objects to path, then creates a new package that points to those objects.
Copies each object in this package to path according to logical key structure,
then adds to the registry a serialized version of this package with
physical keys that point to the new copies.

Note that push is careful to not push data unnecessarily. To illustrate, imagine you have
a PackageEntry: `pkg["entry_1"].physical_key = "/tmp/package_entry_1.json"`

If that entry would be pushed to `s3://bucket/prefix/entry_1.json`, but
`s3://bucket/prefix/entry_1.json` already contains the exact same bytes as
'/tmp/package_entry_1.json', `quilt3` will not push the bytes to s3, no matter what
`selector_fn('entry_1', pkg["entry_1"])` returns.

However, selector_fn will dictate whether the new package points to the local file or to s3:

If `selector_fn('entry_1', pkg["entry_1"]) == False`,
`new_pkg["entry_1"] = ["/tmp/package_entry_1.json"]`

If `selector_fn('entry_1', pkg["entry_1"]) == True`,
`new_pkg["entry_1"] = ["s3://bucket/prefix/entry_1.json"]`

__Arguments__

* __name__:  name for package in registry
* __dest__:  where to copy the objects in the package
    Must be either an S3 URI prefix in the registry bucket, or a callable that takes
* __logical_key, package_entry, and top_hash and returns S3 URI. S3 URIs format is s3__: //$bucket/$key.
* __registry__:  registry where to create the new package
* __message__:  the commit message for the new package
* __selector_fn__:  An optional function that determines which package entries should be copied to S3.
    The function takes in two arguments, logical_key and package_entry, and should return False if that
    PackageEntry should be skipped during push. If for example you have a package where the files
    are spread over multiple buckets and you add a single local file, you can use selector_fn to
    only push the local file to s3 (instead of pushing all data to the destination bucket).
* __workflow__:  workflow ID or `None` to skip workflow validation.
    If not specified, the default workflow will be used.
* __For details see__:  https://docs.quiltdata.com/advanced-usage/workflows


__Returns__

A new package that points to the copied objects.


## Package.rollback(name, registry, top\_hash)  {#Package.rollback}

Set the "latest" version to the given hash.

__Arguments__

* __name(str)__:  Name of package to rollback.
* __registry(str)__:  Registry where package is located.
* __top_hash(str)__:  Hash to rollback to.


## Package.diff(self, other\_pkg)  {#Package.diff}

Returns three lists -- added, modified, deleted.

Added: present in other_pkg but not in self.
Modified: present in both, but different.
Deleted: present in self, but not other_pkg.

__Arguments__

* __other_pkg__:  Package to diff

__Returns__

added, modified, deleted (all lists of logical keys)


## Package.map(self, f, include\_directories=False)  {#Package.map}

Performs a user-specified operation on each entry in the package.

__Arguments__

* __f(x, y)__:  function
    The function to be applied to each package entry.
    It should take two inputs, a logical key and a PackageEntry.
* __include_directories__:  bool
    Whether or not to include directory entries in the map.

Returns: list
    The list of results generated by the map.


## Package.filter(self, f, include\_directories=False)  {#Package.filter}

Applies a user-specified operation to each entry in the package,
removing results that evaluate to False from the output.

__Arguments__

* __f(x, y)__:  function
    The function to be applied to each package entry.
    It should take two inputs, a logical key and a PackageEntry.
    This function should return a boolean.
* __include_directories__:  bool
    Whether or not to include directory entries in the map.

__Returns__

A new package with entries that evaluated to False removed


## Package.verify(self, src, extra\_files\_ok=False)  {#Package.verify}

Check if the contents of the given directory matches the package manifest.

__Arguments__

* __src(str)__:  URL of the directory
* __extra_files_ok(bool)__:  Whether extra files in the directory should cause a failure.

__Returns__

True if the package matches the directory; False otherwise.


# PackageEntry(self, physical\_key, size, hash\_obj, meta)  {#PackageEntry}
Represents an entry at a logical key inside a package.

**\_\_init\_\_**

Creates an entry.

__Arguments__

* __physical_key__:  a URI (either `s3://` or `file://`)
* __size(number)__:  size of object in bytes
* __hash({'type'__:  string, 'value': string}): hash object
* __for example__:  {'type': 'SHA256', 'value': 'bb08a...'}
* __meta(dict)__:  metadata dictionary

__Returns__

a PackageEntry

## __slots__
tuple() -> empty tuple
tuple(iterable) -> tuple initialized from iterable's items

If the argument is a tuple, the return value is the same object.

## physical_keys

Deprecated


## PackageEntry.as\_dict(self)  {#PackageEntry.as\_dict}

Returns dict representation of entry.


## PackageEntry.set\_meta(self, meta)  {#PackageEntry.set\_meta}

Sets the user_meta for this PackageEntry.


## PackageEntry.set(self, path=None, meta=None)  {#PackageEntry.set}

Returns self with the physical key set to path.

__Arguments__

* __path(string)__:  new path to place at logical_key in the package
    Currently only supports a path on local disk
* __meta(dict)__:  metadata dict to attach to entry. If meta is provided, set just
    updates the meta attached to logical_key without changing anything
    else in the entry

__Returns__

self


## PackageEntry.get(self)  {#PackageEntry.get}

Returns the physical key of this PackageEntry.


## PackageEntry.get\_cached\_path(self)  {#PackageEntry.get\_cached\_path}

Returns a locally cached physical key, if available.


## PackageEntry.get\_bytes(self, use\_cache\_if\_available=True)  {#PackageEntry.get\_bytes}

Returns the bytes of the object this entry corresponds to. If 'use_cache_if_available'=True, will first try to
retrieve the bytes from cache.


## PackageEntry.get\_as\_json(self, use\_cache\_if\_available=True)  {#PackageEntry.get\_as\_json}

Returns a JSON file as a `dict`. Assumes that the file is encoded using utf-8.

If 'use_cache_if_available'=True, will first try to retrieve the object from cache.


## PackageEntry.get\_as\_string(self, use\_cache\_if\_available=True)  {#PackageEntry.get\_as\_string}

Return the object as a string. Assumes that the file is encoded using utf-8.

If 'use_cache_if_available'=True, will first try to retrieve the object from cache.


## PackageEntry.deserialize(self, func=None, \*\*format\_opts)  {#PackageEntry.deserialize}

Returns the object this entry corresponds to.

__Arguments__

* __func__:  Skip normal deserialization process, and call func(bytes),
    returning the result directly.
* __**format_opts__:  Some data formats may take options.  Though
    normally handled by metadata, these can be overridden here.

__Returns__

The deserialized object from the logical_key

__Raises__

physical key failure
hash verification fail
when deserialization metadata is not present


## PackageEntry.fetch(self, dest=None)  {#PackageEntry.fetch}

Gets objects from entry and saves them to dest.

__Arguments__

* __dest__:  where to put the files
    Defaults to the entry name

__Returns__

None


## PackageEntry.\_\_call\_\_(self, func=None, \*\*kwargs)  {#PackageEntry.\_\_call\_\_}

Shorthand for self.deserialize()

