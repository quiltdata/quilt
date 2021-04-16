## Showing and hiding features in the Quilt catalog

You can use your Quilt catalog's configuration file to show and hide certain
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
    revisePackage: True
```

### Properties

* `ui.nav.files: False` - hide Files tab
* `ui.nav.packages: False` - hide Packages tab
* `ui.nav.queries: False` - hide Queries tab
* `ui.actions.copyPackage: False` - hide buttons to push packages across buckets
* `ui.actions.createPackage: False` - hide buttons to create packages via
drag-and-drop or from folders in S3
* `ui.actions.revisePackage: False` - hide the button to revise packages
