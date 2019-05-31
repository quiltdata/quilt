Every data package is backed by a **manifest**. A manifest is a self-contained reference sheet for a package, containing all of the files data and metadata necessary to work with a package.

Every time you save a data package to a registry you also save its manifest. You can inspect the manifest yourself using the `manifest` property:

```bash
$ python
>>> import quilt3
>>> p = quilt3.Package().set("foo.txt", "foo.txt")
>>> list(p.manifest)
<<< [
        {'version': 'v0'},
        {'logical_key': 'Roadmap.md',
         'physical_keys': ['file:///.../foo.txt'],
         'size': 1000,
         'hash': None,
         'meta': {}
        }
    ]
```

Manifests saved to disk are in the [jsonl](http://jsonlines.org/)/[ndjson](http://ndjson.org/) format, e.g. JSON strings separated by newlines (`\n`). They are represented as a `list` of `dict` fragments in-memory.

## Manifest specification

The first item in the manifest contains the manifest version number (`version`), the package metadata (`user_meta`), and a package commit message (`message`).

`version` is used to ensure backwards compatibility should the serialization format change. There is currently only one valid `version`: `v0`.

`user_meta` is used to store any user-defined package metadata. In this case this package has no package metadata (yet) so `user_meta` is omitted.

`message` stores the package commit message. It will be `None` if the package is pushed without a commit message. The field is omitted if the package was never subject to a `push`.

Every item after that is a manifest **entry**. Entries may be files/objects or directories. All files in the package will have a corresponding entry, as will all directories with metadata. Directories without metadata are omitted.

The manifest fields are as follows:

* `logical_key` - The path to the entry within the package.
* `physical_keys` - A list of files. Currently this field will always have a single entry. This field is omitted if the entry is a directory.
* `size` - The size of the entry in raw bytes. This field is omitted if the entry is a directory.
* `hash` - [Materialized packages](./Materialization.md) record a content hash for every entry in the package. This field is used to ensure package immutability (the tophash is partly a hash of these hashes).

  If the hash is present it will be a `dict` fragment of the form `{'type': 'SHA256',
   'value': '...'}`. Un-materialized package entries have a `hash` of `None`, as in our example. Directory entries omit this field.
* `meta` - Package entry metadata. Package entries lacking metadata will have a `meta` of `{}` (empty `dict`).

## Saving and loading manifests

In almost all cases you should be using registries, `build`, and `push` to handle sending manifests to and fro. However, there may be advanced use cases where you want to save or load a manifest directly. For that, you can use the low-level manifest API:

```python
import quilt3
p = quilt3.Package()
p.dump("example.jsonl")  # write to file
p.load(open("example.jsonl", "r"))  # read from file
```
