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

## Custom overviews for buckets, folders

`quilt_summarize.json` is a configuration file that works in any S3 folder or in
any Quilt package. `quilt_summarize.json` is a JSON array
of files that you wish to preview in the catalog.

The simplest summary is just a list of relative paths to files that you wish to preview:

```json
// quilt_summarize.json
[
  "file1.json",
  "file2.csv",
  "file3.ipynb"
]
```
By default each list element renders in its own row.

![](./imgs/quilt-summarize-rows.png)

For more sophisticated layouts, you can break a row into columns by providing an
array instead of a string:

```json
// quilt_summarize.json
[
  "file1.json",
  [{
    "path": "file2.csv",
    "width": "200px",
  }, {
    "path": "file3.ipynb",
    "title": "Scientific notebook",
    "description": "[See docs](https://docs.com)"
  }]
]
```
![](./imgs/quilt-summarize-columns.png)

Each element of an array in `quilt_summarize.json` can either be a path string
or an object with one or more of the following properties:
- `path` - file path relative to `quilt_summarize.json`
- `title` - title rendered instead of file path
- `description` - description in markdown format
- `width` - column width either in pixels or ratio (default is ratio `1`)

`quilt_summarize.json` will render in any directory that contains a file of the
same name, in both bucket view and package view.
