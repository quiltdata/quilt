# quilt3.Package

## Package\(self\) <a id="Package"></a>

In-memory representation of a package

### manifest

Provides a generator of the dicts that make up the serialized package.

### top\_hash

Returns the top hash of the package.

Note that physical keys are not hashed because the package has the same semantics regardless of where the bytes come from.

**Returns**

A string that represents the top hash of the package

### Package.\_\_repr\_\_\(self, max\_lines=20\) <a id="Package.\_\_repr\_\_"></a>

String representation of the Package.

### Package.install\(name, registry=None, top\_hash=None, dest=None, dest\_registry=None, \*, path=None\) <a id="Package.install"></a>

Installs a named package to the local registry and downloads its files.

**Arguments**

* **name\(str\)**:  Name of package to install. It also can be passed as NAME/PATH

    \(/PATH is deprecated, use the `path` parameter instead\),

    in this case only the sub-package or the entry specified by PATH will

    be downloaded.

* **registry\(str\)**:  Registry where package is located.

    Defaults to the default remote registry.

* **top\_hash\(str\)**:  Hash of package to install. Defaults to latest.
* **dest\(str\)**:  Local path to download files to.
* **dest\_registry\(str\)**:  Registry to install package to. Defaults to local registry.
* **path\(str\)**:  If specified, downloads only `path` or its children.

### Package.resolve\_hash\(name, registry, hash\_prefix\) <a id="Package.resolve\_hash"></a>

Find a hash that starts with a given prefix.

**Arguments**

* **name \(str\)**:  name of package
* **registry \(str\)**:  location of registry
* **hash\_prefix \(str\)**:  hash prefix with length between 6 and 64 characters

### Package.browse\(name, registry=None, top\_hash=None\) <a id="Package.browse"></a>

Load a package into memory from a registry without making a local copy of the manifest.

**Arguments**

* **name\(string\)**:  name of package to load
* **registry\(string\)**:  location of registry to load package from
* **top\_hash\(string\)**:  top hash of package version to load

### Package.\_\_contains\_\_\(self, logical\_key\) <a id="Package.\_\_contains\_\_"></a>

Checks whether the package contains a specified logical\_key.

**Returns**

True or False

### Package.\_\_getitem\_\_\(self, logical\_key\) <a id="Package.\_\_getitem\_\_"></a>

Filters the package based on prefix, and returns either a new Package or a PackageEntry.

**Arguments**

* **prefix\(str\)**:  prefix to filter on

**Returns**

PackageEntry if prefix matches a logical\_key exactly otherwise Package

### Package.fetch\(self, dest='./'\) <a id="Package.fetch"></a>

Copy all descendants to `dest`. Descendants are written under their logical names _relative_ to self.

**Arguments**

* **dest**:  where to put the files \(locally\)

**Returns**

A new Package object with entries from self, but with physical keys pointing to files in `dest`.

### Package.keys\(self\) <a id="Package.keys"></a>

Returns logical keys in the package.

### Package.walk\(self\) <a id="Package.walk"></a>

Generator that traverses all entries in the package tree and returns tuples of \(key, entry\), with keys in alphabetical order.

### Package.load\(readable\_file\) <a id="Package.load"></a>

Loads a package from a readable file-like object.

**Arguments**

* **readable\_file**:  readable file-like object to deserialize package from

**Returns**

A new Package object

**Raises**

file not found json decode error invalid package exception

### Package.set\_dir\(self, lkey, path=None, meta=None, update\_policy='incoming'\) <a id="Package.set\_dir"></a>

Adds all files from `path` to the package.

Recursively enumerates every file in `path`, and adds them to the package according to their relative location to `path`.

**Arguments**

* **lkey\(string\)**:  prefix to add to every logical key,

    use '/' for the root of the package.

* **path\(string\)**:  path to scan for files to add to package.

    If None, lkey will be substituted in as the path.

* **meta\(dict\)**:  user level metadata dict to attach to lkey directory entry.
* **update\_policy\(str\)**:  can be either 'incoming' \(default\) or 'existing'.

    If 'incoming', whenever logical keys match, always take the new entry from set\_dir.

    If 'existing', whenever logical keys match, retain existing entries

    and ignore new entries from set\_dir.

**Returns**

self

**Raises**

* `PackageException`:  When `path` doesn't exist.
* `ValueError`:  When `update_policy` is invalid.

### Package.get\(self, logical\_key\) <a id="Package.get"></a>

Gets object from logical\_key and returns its physical path. Equivalent to self\[logical\_key\].get\(\).

**Arguments**

* **logical\_key\(string\)**:  logical key of the object to get

**Returns**

Physical path as a string.

**Raises**

* `KeyError`:  when logical\_key is not present in the package
* `ValueError`:  if the logical\_key points to a Package rather than PackageEntry.

### Package.readme\(self\) <a id="Package.readme"></a>

Returns the README PackageEntry

The README is the entry with the logical key 'README.md' \(case-sensitive\). Will raise a QuiltException if no such entry exists.

### Package.set\_meta\(self, meta\) <a id="Package.set\_meta"></a>

Sets user metadata on this Package.

### Package.build\(self, name, registry=None, message=None\) <a id="Package.build"></a>

Serializes this package to a registry.

**Arguments**

* **name**:  optional name for package
* **registry**:  registry to build to

  ```text
    defaults to local registry
  ```

* **message**:  the commit message of the package

**Returns**

The top hash as a string.

### Package.dump\(self, writable\_file\) <a id="Package.dump"></a>

Serializes this package to a writable file-like object.

**Arguments**

* **writable\_file**:  file-like object to write serialized package.

**Returns**

None

**Raises**

fail to create file fail to finish write

### Package.set\(self, logical\_key, entry=None, meta=None, serialization\_location=None, serialization\_format\_opts=None\) <a id="Package.set"></a>

Returns self with the object at logical\_key set to entry.

**Arguments**

* **logical\_key\(string\)**:  logical key to update
* **entry\(PackageEntry OR string OR object\)**:  new entry to place at logical\_key in the package.

    If entry is a string, it is treated as a URL, and an entry is created based on it.

    If entry is None, the logical key string will be substituted as the entry value.

    If entry is an object and quilt knows how to serialize it, it will immediately be serialized and

    written to disk, either to serialization\_location or to a location managed by quilt. List of types that

    Quilt can serialize is available by calling `quilt3.formats.FormatRegistry.all_supported_formats()`

* **meta\(dict\)**:  user level metadata dict to attach to entry
* **serialization\_format\_opts\(dict\)**:  Optional. If passed in, only used if entry is an object. Options to help

    Quilt understand how the object should be serialized. Useful for underspecified file formats like csv

    when content contains confusing characters. Will be passed as kwargs to the FormatHandler.serialize\(\)

    function. See docstrings for individual FormatHandlers for full list of options -

* **https**: //github.com/quiltdata/quilt/blob/master/api/python/quilt3/formats.py
* **serialization\_location\(string\)**:  Optional. If passed in, only used if entry is an object. Where the

    serialized object should be written, e.g. "./mydataframe.parquet"

**Returns**

self

### Package.delete\(self, logical\_key\) <a id="Package.delete"></a>

Returns the package with logical\_key removed.

**Returns**

self

**Raises**

* `KeyError`:  when logical\_key is not present to be deleted

### Package.push\(self, name, registry=None, dest=None, message=None, selector\_fn=None\) <a id="Package.push"></a>

Copies objects to path, then creates a new package that points to those objects. Copies each object in this package to path according to logical key structure, then adds to the registry a serialized version of this package with physical keys that point to the new copies.

Note that push is careful to not push data unnecessarily. To illustrate, imagine you have a PackageEntry: `pkg["entry_1"].physical_key = "/tmp/package_entry_1.json"`

If that entry would be pushed to `s3://bucket/prefix/entry_1.json`, but `s3://bucket/prefix/entry_1.json` already contains the exact same bytes as '/tmp/package\_entry\_1.json', `quilt3` will not push the bytes to s3, no matter what `selector_fn('entry_1', pkg["entry_1"])` returns.

However, selector\_fn will dictate whether the new package points to the local file or to s3:

If `selector_fn('entry_1', pkg["entry_1"]) == False`, `new_pkg["entry_1"] = ["/tmp/package_entry_1.json"]`

If `selector_fn('entry_1', pkg["entry_1"]) == True`, `new_pkg["entry_1"] = ["s3://bucket/prefix/entry_1.json"]`

**Arguments**

* **name**:  name for package in registry
* **dest**:  where to copy the objects in the package
* **registry**:  registry where to create the new package
* **message**:  the commit message for the new package
* **selector\_fn**:  An optional function that determines which package entries should be copied to S3.

    The function takes in two arguments, logical\_key and package\_entry, and should return False if that

    PackageEntry should be skipped during push. If for example you have a package where the files

    are spread over multiple buckets and you add a single local file, you can use selector\_fn to

    only push the local file to s3 \(instead of pushing all data to the destination bucket\).

**Returns**

A new package that points to the copied objects.

### Package.rollback\(name, registry, top\_hash\) <a id="Package.rollback"></a>

Set the "latest" version to the given hash.

**Arguments**

* **name\(str\)**:  Name of package to rollback.
* **registry\(str\)**:  Registry where package is located.
* **top\_hash\(str\)**:  Hash to rollback to.

### Package.diff\(self, other\_pkg\) <a id="Package.diff"></a>

Returns three lists -- added, modified, deleted.

Added: present in other\_pkg but not in self. Modified: present in both, but different. Deleted: present in self, but not other\_pkg.

**Arguments**

* **other\_pkg**:  Package to diff

**Returns**

added, modified, deleted \(all lists of logical keys\)

### Package.map\(self, f, include\_directories=False\) <a id="Package.map"></a>

Performs a user-specified operation on each entry in the package.

**Arguments**

* **f\(x, y\)**:  function

    The function to be applied to each package entry.

    It should take two inputs, a logical key and a PackageEntry.

* **include\_directories**:  bool

    Whether or not to include directory entries in the map.

Returns: list The list of results generated by the map.

### Package.filter\(self, f, include\_directories=False\) <a id="Package.filter"></a>

Applies a user-specified operation to each entry in the package, removing results that evaluate to False from the output.

**Arguments**

* **f\(x, y\)**:  function

    The function to be applied to each package entry.

    It should take two inputs, a logical key and a PackageEntry.

    This function should return a boolean.

* **include\_directories**:  bool

    Whether or not to include directory entries in the map.

**Returns**

A new package with entries that evaluated to False removed

### Package.verify\(self, src, extra\_files\_ok=False\) <a id="Package.verify"></a>

Check if the contents of the given directory matches the package manifest.

**Arguments**

* **src\(str\)**:  URL of the directory
* **extra\_files\_ok\(bool\)**:  Whether extra files in the directory should cause a failure.

**Returns**

True if the package matches the directory; False otherwise.

## PackageEntry\(self, physical\_key, size, hash\_obj, meta\) <a id="PackageEntry"></a>

Represents an entry at a logical key inside a package.

**\_\_init\_\_**

Creates an entry.

**Arguments**

* **physical\_key**:  a URI \(either `s3://` or `file://`\)
* **size\(number\)**:  size of object in bytes
* **hash\({'type'**:  string, 'value': string}\): hash object
* **for example**:  {'type': 'SHA256', 'value': 'bb08a...'}
* **meta\(dict\)**:  metadata dictionary

**Returns**

a PackageEntry

### **slots**

list\(\) -&gt; new empty list list\(iterable\) -&gt; new list initialized from iterable's items

### physical\_keys

Deprecated

### PackageEntry.as\_dict\(self\) <a id="PackageEntry.as\_dict"></a>

Returns dict representation of entry.

### PackageEntry.set\_meta\(self, meta\) <a id="PackageEntry.set\_meta"></a>

Sets the user\_meta for this PackageEntry.

### PackageEntry.set\(self, path=None, meta=None\) <a id="PackageEntry.set"></a>

Returns self with the physical key set to path.

**Arguments**

* **logical\_key\(string\)**:  logical key to update
* **path\(string\)**:  new path to place at logical\_key in the package

    Currently only supports a path on local disk

* **meta\(dict\)**:  metadata dict to attach to entry. If meta is provided, set just

    updates the meta attached to logical\_key without changing anything

    else in the entry

**Returns**

self

### PackageEntry.get\(self\) <a id="PackageEntry.get"></a>

Returns the physical key of this PackageEntry.

### PackageEntry.get\_cached\_path\(self\) <a id="PackageEntry.get\_cached\_path"></a>

Returns a locally cached physical key, if available.

### PackageEntry.get\_bytes\(self, use\_cache\_if\_available=True\) <a id="PackageEntry.get\_bytes"></a>

Returns the bytes of the object this entry corresponds to. If 'use\_cache\_if\_available'=True, will first try to retrieve the bytes from cache.

### PackageEntry.get\_as\_json\(self, use\_cache\_if\_available=True\) <a id="PackageEntry.get\_as\_json"></a>

Returns a JSON file as a `dict`. Assumes that the file is encoded using utf-8.

If 'use\_cache\_if\_available'=True, will first try to retrieve the object from cache.

### PackageEntry.get\_as\_string\(self, use\_cache\_if\_available=True\) <a id="PackageEntry.get\_as\_string"></a>

Return the object as a string. Assumes that the file is encoded using utf-8.

If 'use\_cache\_if\_available'=True, will first try to retrieve the object from cache.

### PackageEntry.deserialize\(self, func=None, \*\*format\_opts\) <a id="PackageEntry.deserialize"></a>

Returns the object this entry corresponds to.

**Arguments**

* **func**:  Skip normal deserialization process, and call func\(bytes\),

    returning the result directly.

* **\*\*format\_opts**:  Some data formats may take options.  Though

    normally handled by metadata, these can be overridden here.

**Returns**

The deserialized object from the logical\_key

**Raises**

physical key failure hash verification fail when deserialization metadata is not present

### PackageEntry.fetch\(self, dest=None\) <a id="PackageEntry.fetch"></a>

Gets objects from entry and saves them to dest.

**Arguments**

* **dest**:  where to put the files

    Defaults to the entry name

**Returns**

None

### PackageEntry.\_\_call\_\_\(self, func=None, \*\*kwargs\) <a id="PackageEntry.\_\_call\_\_"></a>

Shorthand for self.deserialize\(\)

