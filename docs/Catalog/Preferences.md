# Configuration

## Show and hide features in the Quilt catalog

You can use the configuration file to show or hide certain
tabs and buttons in the Quilt catalog. This gives you fine-grained control
over how users interact with the Quilt catalog. There is one catalog config file 
per-bucket. The config file's path is `s3://BUCKET/.quilt/catalog/config.yaml`.

If there is no config.yaml, or your config.yaml file does not override the `ui`
key, then the following defaults are used:

```
ui:
  nav:
    files: True
    packages: True
    queries: True
  actions:
    copyPackage: True
    createPackage: True
    deleteRevision: False
    revisePackage: True
  blocks:
    analytics: True
    browser: True
    code: True
    meta: True
  packages:
    *:
      message: True
  sourceBuckets:
    s3://BUCKET_1: {}
    s3://BUCKET_2: {}
```

### Properties

* `ui.nav.files: False` - hide Files tab
* `ui.nav.packages: False` - hide Packages tab
* `ui.nav.queries: False` - hide Queries tab
* `ui.actions.copyPackage: False` - hide buttons to push packages across buckets
* `ui.actions.createPackage: False` - hide buttons to create packages via
drag-and-drop or from folders in S3
* `ui.actions.deleteRevision: True` - show buttons to delete package revision
* `ui.actions.revisePackage: False` - hide the button to revise packages
* `ui.blocks.analytics: False` - hide Analytics block on file page
* `ui.blocks.browser: False` - hide files browser on both Bucket and Packages tab
* `ui.blocks.code: False` - hide Code block with quilt3 code boilerplate
* `ui.blocks.meta: False` - hide Metadata block on Package page
* `ui.sourceBuckets` - a dictionary of S3 bucket names that map to an empty object reserved for future enhancements;
buckets in this dictionary are the ones offered when the user clicks
Revise Package > Add files from Bucket; if the dictionary is not set or is empty the feature "Add files from Bucket" is disabled
* `ui.defaultSourceBucket` - source bucket from `ui.sourceBuckets` that is selected by default; if it doesn't match any bucket then it's ignored
* `ui.packages` - a dictionary of packages or `*` glob for all package names that map to a config specified visibility of message in the package list and JSON paths of `user_meta` (package metadata) to show

#### `ui.packages` example

Sample config to show `message` for every package and the "namespace/packageA" package in particular.
If you provide this metadata `{"key1": {"key2": "Lorem ipsum"}, "key3: ["tag1", "tag2"], "key4": "tagA", "tagB" }` for "namespace/packageA", then we extract it according to the following config and show:
  * Lorem imsum
  * tag1, tag2
  * tagA

```
ui:
  packages:
    *:
      message: True
      user_meta:
        - $.Name
    namespace/packageA:
      message: True
      user_meta:
        - $.key1.key2
        - $.key3
        - $.key4[0]
```
