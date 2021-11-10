## Show and hide features in the Quilt catalog

You can use your Quilt catalog's configuration file to show or hide certain
tabs and buttons in the Quilt catalog. This gives you finer-grained control
over how users interact with the Quilt catalog. The catalog config file is per-bucket.
The file's path is `s3://BUCKET/.quilt/catalog/config.yaml`.

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
* `ui.sourceBuckets` - a dictionary of S3 bucket names that map to an empty object reserved for future enhancements;
buckets in this dictionary are the ones offered when the user clicks
Revise Package > Add files from Bucket; if the dictionary is not set or is empty the feature "Add files from Bucket" is disabled
* `ui.defaultSourceBucket` - source bucket from `ui.sourceBuckets` that is selected by default; if it doesn't match any bucket then it's ignored
