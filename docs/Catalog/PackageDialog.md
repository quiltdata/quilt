# Opening package dialog via a URL

You can use the `createPackage` query parameter to create a URL that opens
the Quilt Catalog directly to the package dialog with certain information
already filled in.

Available parameters are

* `createPackage=true` to open a package dialog,
* `dropZoneOnly=true` to hide everything from the package dialog except files
  drop zone,
* `msg` to set the commit message,
* `name` to set the  package name,
* `workflow` to set workflow ID.

You can use `?createPackage=true` on almost any page, and it will open a package
dialog depending on the context:

* on the package page: revise the current package
* on the package list: create package from scratch
* on the bucket directory: create a package from the current directory

Note, that when you set `dropZoneOnly=true`, all other input fields are hidden,
and inaccessible to keyboard input, so you should fill them some other way:

* package name can be
  * autofilled when you revise package,
    i.e. open a package dialog from the package page
  * autofilled using
    [`package_handle`](../advanced/workflows#package-name-defaults-quilt-catalog)
  * set using `name` parameter
    (ex., `?createPackage=true&dropZoneOnly=true&name=foo/bar`)
* commit message can be set using the `msg` parameter
  (ex., `?createPackage=true&dropZoneOnly=true&msg=Test+message`)
* workflow ID, is optional unless `is_workflow_required: True` in
  [`.quilt/workflows/config.yml`](../advanced/workflows#package-name-defaults-quilt-catalog).
  You can set it
  * using the `default_workflow` field in `.quilt/workflows/config.yml`
  * `workflow` parameter
    (ex. `?createPackage=true&dropZoneOnly=true&msg=Test+message&workflow=w-id`)

## Examples

Open "Create package" dialog:
`https://your-stack/b/bucket/packages/?createPackage=true`.

Open "Revise package" dialog:
`https://your-stack/b/bucket/packages/foo/bar/?createPackage=true`.

Open "Create package" dialog and set initial values:
`https://your-stack/b/bucket/packages/?createPackage=true&name=foo/bar&msg=Test commit&workflow=my-wrkflw-id`.

Open "Revise package" in simplified form:
`https://your-stack/b/bucket/packages/foo/bar/?createPackage=true&dropZoneOnly=true&msg=Test+commit`.

Open "Revise package" dialog, use content of the `foo/bar` package and create
`abc/xyz` package (or push new revision if `abc/xyz` exists):
`https://your-stack/b/bucket/packages/foo/bar/?createPackage=true&name=abc/xyz`.
