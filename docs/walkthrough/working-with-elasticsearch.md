<!-- markdownlint-disable -->

### About elastic search

Quilt is currently pinned to ElasticSearch 6.7
### Upload package

You can upload a new package providing the name of the package, commit message, files, metadata, and [workflow](../advanced-features/workflows.md).

The name should have the format `namespace/package-name`.

The message needs to add notes on a new revision for this package.

Files are the content of your package.

The associated workflow contains the rules for validating your package.

The metadata can be added with JSON editor, represented as a key/value table with infinite nesting. If workflow contains JSON schema, you will have predefined key/value pairs according to the schema.

#### JSON editor

To add a new key/value field double click on an empty cell and type key name, then press "Enter" or "Tab", or click outside of the cell. To change value double click on that value.

Values can be strings, numbers, arrays, or objects. Every value that you type will be parsed as JSON.

We don't support references and compound types yet.

### Push to bucket

You can push the existing package from one bucket to another. To use this feature consult [workflows](../advanced-features/workflows.md) page.

### Summarize

Adding a `quilt_summarize.json` file to a data package (or S3 directory path) will enable content preview right on the landing page.

![](../imgs/catalog_package_landing_page.png)

Colocating data with context in this way is a simple way of making your data projects approachable and accessible to collaborators.

`quilt_summarize.json` can be a list of paths to files in S3 that you want to include in your summary. For example: `["description.md", "../notebooks/exploration.ipynb"]`. Additionally, note that if a `README.md` file is present, it will always be rendered as well.

> There are currently some small limitations with preview:
>
> * Objects linked to in `quilt_summarize.json` are always previewed as of the latest version, even if you are browsing an old version of a package.
> * Object titles and image thumbnails link to the file view, even if you are in the package view.

## Admin UI

The Quilt catalog includes an admin panel that allows you to manage users and buckets in your stack and to customize your Quilt catalog.
See [Admin UI docs](../Catalog/Admin.md) for details.


**[To learn more, check out the public demo catalog](https://open.quiltdata.com/b/quilt-example)**.
