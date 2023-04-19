# Package dialog state

You can use permanent links to the package dialog with pre-defined state.

To control pre-filled values you can use these query string parameters:

* `msg` sets commit message
* `name` sets package name
* `workflow` sets workflow id

To open package dialog, use `createPackage`.

To show package dialog in simplified form with dropzone only use `dropZoneOnly`.
Since other fields are hidden, you should set them via query string parameters.
So, `msg` is required always. `name` is required if package name is not set by
other ways like opening package dialog from existing package, or if
[`package_handle`](../advanced/workflows#package-name-defaults-quilt-catalog) is
missing. `workflow` is required if `is_workflow_required` is set to `True` and
`default_workflow` is missing, see
[workflows docs](../advanced/workflows#package-name-defaults-quilt-catalog).

## Examples

Open "Create package" dialog:
`https://your-stack/b/bucket/packages/?createPackage=true`.

Open "Revise package" dialog:
`https://your-stack/b/bucket/packages/foo/bar/?createPackage=true`.

Open "Create package" dialog and set initial values:
`https://your-stack/b/bucket/packages/?createPackage=true&name=foo/bar&msg=Test commit&workflow=my-wrkflw-id`.

Open "Create package" in simplified form:
<!-- markdownlint-disable-next-line line-length -->
`https://your-stack/b/bucket/packages/foo/bar/?createPackage=true&dropZoneOnly=true&msg=Test commit`.
