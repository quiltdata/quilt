<!-- markdownlint-disable-next-line first-line-h1 -->
Every S3 bucket attached to Quilt has a "Bucket" tab in the Catalog
that displays all files in the bucket.

![Files browser tab](../imgs/catalog-filesbrowser-tab.png)

> If desired, [this tab can be hidden](./Preferences.md).

## Bookmarks

To create a package that includes multiple files from different
directories in a single S3 bucket, or even across different S3
buckets attached to Quilt, you can browse and create a "bookmark"
of chosen files. Select files by checking the box and clicking "Add
to bookmarks". You can also navigate to a specific file and bookmark
an individual file by clicking "Add to bookmarks".

![Select files](../imgs/catalog-filesbrowser-select.png)

![Add selected files to bookmarks](../imgs/catalog-filesbrowser-addtobookmarks.png)

Open the Bookmarks pane (listed in the User account menu) and
optionally create a new package from the bookmarked files.

![Open bookmarks](../imgs/catalog-filesbrowser-bookmarksmenu.png)

![Browse bookmarks](../imgs/catalog-filesbrowser-bookmarkspane.png)

## Text editor

Inline editing of plain text, Markdown, JSON and YAML file formats
is supported.

![Edit button](../imgs/catalog-texteditor-edit.png)

New text files can be created individually in editable file formats.
To create one, click the «kebab» menu (three vertical dots) located
in the far-right, above the file browser. Choose a file name and
format (the default is README.md), enter your content, and click save.

![Open menu](../imgs/catalog-texteditor-create.png)

![Choose name](../imgs/catalog-texteditor-name.png)

![Edit file](../imgs/catalog-texteditor-main.png)

## Working with Amazon S3 Glacier storage classes

Glacier storage classes are built for data archiving. Quilt is
compatible with S3 bucket lifecycle rules that transition S3 objects to
Glacier storage classes.

There are currently three types of S3 object archive storage class that
work differently with the Quilt Catalog, `quilt3` CLI and Python API.

1. **S3 Glacier Instant Retrieval:** Objects in this storage class are
available as normal in the Bucket and Packages tabs in the Quilt
Catalog.
1. **S3 Glacier Flexible Retrieval (formerly S3 Glacier):** Objects are
not immediately available and appear "grayed out" in the Catalog.
1. **S3 Glacier Deep Archive:** Objects are
not immediately available and appear "grayed out" in the Catalog.

![Glacier S3 objects list
view](../imgs/catalog-filesbrowser-glacier-listview.png)

Previewing a specific "glacierized" S3 object returns an "Object
Archived: Preview not available" message. To successfully preview
the S3 object, you need to restore it first.

![Glacier S3 objects object
view](../imgs/catalog-filesbrowser-glacier-objectview.png)

> The AWS Glacier service is rapidly evolving and may impact the
functionality of the Quilt Catalog and/or API.
