
# Package(self)  {#Package}
In-memory representation of a package

## manifest

Provides a generator of the dicts that make up the serialied package.


## top_hash

Returns the top hash of the package.

Note that physical keys are not hashed because the package has
    the same semantics regardless of where the bytes come from.

__Returns__

A string that represents the top hash of the package


## Package.\_\_repr\_\_(self, max\_lines=20)  {#Package.\_\_repr\_\_}

String representation of the Package.


## Package.install(name, registry=None, top\_hash=None, dest=None, dest\_registry=None)  {#Package.install}

Installs a named package to the local registry and downloads its files.

__Arguments__

* __name(str)__:  Name of package to install.
* __registry(str)__:  Registry where package is located.
    Defaults to the default remote registry.
* __top_hash(str)__:  Hash of package to install. Defaults to latest.
* __dest(str)__:  Local path to download files to.
* __dest_registry(str)__:  Registry to install package to. Defaults to local registry.

__Returns__

A new Package that points to files on your local machine.


## Package.browse(name=None, registry=None, top\_hash=None)  {#Package.browse}

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

None


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


## Package.set\_dir(self, lkey, path=None, meta=None)  {#Package.set\_dir}

Adds all files from `path` to the package.

Recursively enumerates every file in `path`, and adds them to
    the package according to their relative location to `path`.

__Arguments__

* __lkey(string)__:  prefix to add to every logical key,
    use '/' for the root of the package.
* __path(string)__:  path to scan for files to add to package.
    If None, lkey will be substituted in as the path.
* __meta(dict)__:  user level metadata dict to attach to lkey directory entry.

__Returns__

self

__Raises__

When `path` doesn't exist


## Package.get(self, logical\_key=None)  {#Package.get}

Gets object from logical_key and returns its physical path.
Equivalent to self[logical_key].get().

__Arguments__

* __logical_key(string)__:  logical key of the object to get

__Returns__

Physical path as a string.

__Raises__

* `KeyError`:  when logical_key is not present in the package
* `ValueError`:  if the logical_key points to a Package rather than PackageEntry.


## Package.set\_meta(self, meta)  {#Package.set\_meta}

Sets user metadata on this Package.


## Package.build(self, name=None, registry=None, message=None)  {#Package.build}

Serializes this package to a registry.

__Arguments__

* __name__:  optional name for package
* __registry__:  registry to build to
        defaults to local registry
* __message__:  the commit message of the package

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


## Package.set(self, logical\_key, entry=None, meta=None)  {#Package.set}

Returns self with the object at logical_key set to entry.

__Arguments__

* __logical_key(string)__:  logical key to update
* __entry(PackageEntry OR string)__:  new entry to place at logical_key in the package.
    If entry is a string, it is treated as a URL, and an entry is created based on it.
    If entry is None, the logical key string will be substituted as the entry value.
* __meta(dict)__:  user level metadata dict to attach to entry

__Returns__

self


## Package.delete(self, logical\_key)  {#Package.delete}

Returns the package with logical_key removed.

__Returns__

self

__Raises__

* `KeyError`:  when logical_key is not present to be deleted


## Package.push(self, name, registry=None, dest=None, message=None)  {#Package.push}

Copies objects to path, then creates a new package that points to those objects.
Copies each object in this package to path according to logical key structure,
then adds to the registry a serialized version of this package with
physical keys that point to the new copies.

__Arguments__

* __name__:  name for package in registry
* __dest__:  where to copy the objects in the package
* __registry__:  registry where to create the new package
* __message__:  the commit message for the new package

__Returns__

A new package that points to the copied objects.


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

* __f__:  function
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

* __f__:  function
    The function to be applied to each package entry.
    This function should return a boolean.
* __include_directories__:  bool
    Whether or not to include directory entries in the map.

__Returns__

A new package with entries that evaluated to False removed

