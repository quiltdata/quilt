# Configuration

## Show and hide features in the Quilt catalog

You can use the configuration file to show or hide certain
tabs and buttons in the Quilt catalog. This gives you fine-grained control
over how users interact with the Quilt catalog. There is one catalog config file
per-bucket. The config file's path is `s3://BUCKET/.quilt/catalog/config.yaml`.

If there is no config.yaml, or your config.yaml file does not override the `ui`
key, then the following defaults are used:

```yaml
ui:
  nav:
    files: True
    workflows: True
    packages: True
    queries: True
  actions:
    copyPackage: True
    createPackage: True
    deleteObject: False
    deleteRevision: False
    downloadObject: True
    downloadPackage: True
    revisePackage: True
    writeFile: True
  blocks:
    analytics: True
    browser: True
    code: True
    gallery:
      files: True
      packages: True
      overview: True
      summarize: True
    meta:
      user_meta:
        expanded: False
      workflows:
        expanded: False
  package_description:
    .*:
      message: True
  package_description_multiline: False
```

### Properties

* `ui.nav.files: False` - hide Files tab
* `ui.nav.workflows: False` - hide Workflows tab
* `ui.nav.packages: False` - hide Packages tab
* `ui.nav.queries: False` - hide Queries tab
* `ui.actions: False` - hide all buttons used to create and edit packages and files
(make the catalog "read-only")
* `ui.actions.copyPackage: False` - hide buttons to push packages across buckets
* `ui.actions.createPackage: False` - hide buttons to create packages via
drag-and-drop or from folders in S3
* `ui.actions.deleteObject: True` - show buttons to delete files and directories
* `ui.actions.deleteRevision: True` - show buttons to delete package revision
* `ui.actions.downloadObject: False` - hide download buttons under "Bucket" tab
* `ui.actions.downloadPackage: False` - hide download buttons under "Packages" tab
* `ui.actions.revisePackage: False` - hide the button to revise packages
* `ui.actions.writeFile: False` - hide buttons to create or edit files
* `ui.blocks.analytics: False` - hide Analytics block on file page
* `ui.blocks.browser: False` - hide files browser on both Bucket and Packages tab
* `ui.blocks.code: False` - hide Code block with quilt3 code boilerplate
* `ui.blocks.gallery: False` - hide all galleries (see below for list of galleries)
* `ui.blocks.gallery.files: False` - hide gallery in Bucket tab;
this gallery lists all images in the current directory
* `ui.blocks.gallery.packages: False` - hide gallery in Packages tab;
this gallery lists all images in the current directory in package
* `ui.blocks.gallery.overview: False` - hide gallery in Overview tab;
this gallery lists all images in the current bucket
* `ui.blocks.gallery.summarize: False` - hide gallery when `quilt_summarize.json`
is present
* `ui.blocks.meta: False` - hide Metadata block on Package page
* `ui.blocks.meta.user_meta.expanded: True` - expands user_meta properties
* `ui.blocks.meta.workflows.expanded: 2` - expands workflows two level deep
* `ui.sourceBuckets` - a dictionary of S3 bucket names
that map to an empty object reserved for future enhancements;
buckets in this dictionary are the ones offered when the user clicks
Revise Package > Add files from Bucket; by default, the current bucket
is always available; set to an empty dictionary `{}` to disable this feature
* `ui.defaultSourceBucket` - source bucket from `ui.sourceBuckets`
that is selected by default; if it doesn't match any bucket then it's ignored
* `ui.package_description` - a dictionary
that maps package handle regular expressions
to JSONPath expressions of fields to show from package metadata
in the package list view.
* `ui.package_description_multiline: True` - expands package metadata's root key/values
* `ui.athena.defaultWorkgroup` - default workgroup to select on the Athena page

![Alongside text editor users can use visual form to modify the config](../imgs/bucket-preferences-editor.png)

#### `ui.sourceBuckets` example

```yaml
ui:
  sourceBuckets:
    s3://bucket-a: {}
    s3://bucket-b: {}
    s3://bucket-c: {}
  defaultSourceBucket: s3://bucket-b
```

By default, users can add files from the current bucket when creating
or revising packages. The current bucket is automatically available
in the file picker without requiring configuration.
To restrict this functionality and disable adding files from any bucket
(including the current one), set `ui.sourceBuckets` to an empty dictionary `{}`
in your configuration file.

#### `ui.package_description` example

```yaml
ui:
  package_description:
    # match all packages
    .*:
      # show the message
      message: True
      # show the .labels field
      user_meta:
        - $.labels
    # for any package with a handle prefix of foo
    ^foo/.*:
      # JSONPath expressions to the fields to display
      user_meta:
        - $.key1.key2
        - $.key3
        - $.key4[0]
```

![Example of package_description use](../imgs/package-list-selective-metadata.png)

#### `ui.athena` example

```yaml
ui:
  athena:
    defaultWorkgroup: primary
```

#### `ui.blocks.meta`

User could set it to boolean or object with additional properties.
Object is a truthy value, so any object acts like `True`.

``` yaml
# default value, show Metadata block
ui:
  blocks:
    meta: True
```

``` yaml
# Hide Metadata block
ui:
  blocks:
    meta: False
```

``` yaml
# Show Metadata block and expand `user_meta` object
# consider large `user_meta` objects, they can affect UI responsiveness
ui:
  blocks:
    meta:
      user_meta:
        expanded: True
```
