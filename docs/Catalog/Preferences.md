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

## Customize bucket's overview page

### TODO: Overview URL

You can set a list of files to output using `quilt_summarize.json`.

Use array as a list of rows, each row can be one file or list of files (columns). You can set file source as a path relative to `quilt_summarize.json` or as an object containing path (required), title, description, or width.

This is a list of three files one after another:

```json
# quilt_summarize.json
[
  "file1.json",
  "file2.csv",
  "file3.ipynb"
]
```

This layout contains two rows. First row is a file "file1.json" , and the second has two columns: "file2.csv", 200px width, and "file3.ipynb" with title and description.

```json
# quilt_summarize.json
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

Any directory can contain `quilt_summarize.json` providing layout to output while browsing this directory.

### File properties

- `path` - file path relative to `quilt_summarize.json`
- `title` - title rendered instead of file path
- `description` - description leveraging Markdown syntax
- `width` - column width either in pixels or ratio (default is ratio `1`)
