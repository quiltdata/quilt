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
selected items to bookmarks". You can also navigate to a specific
file and bookmark an individual file by clicking "Add to bookmarks".

![Select and add to bookmarks](../imgs/catalog-filesbrowser-addtobookmarks.png)

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

## Working with Amazon S3 Glacier

Glacier storage classes are built for data archiving. There are
several types of S3 object archive storage class that have implications for
working with Quilt data packages:

1. **S3 Glacier Instant Retrieval:** Objects in this storage class as
available as normal in the Bucket and Packages tabs in the Quilt
catalog.
1. **S3 Glacier Flexible Retrieval (formerly S3 Glacier):** Objects are
not immediately available and appear "grayed out" in the catalog.

![Glacier S3 objects list view](../imgs/catalog-filesbrowser-glacier-listview.png)

Previewing a specific S3 object returns an "Object Archived: Preview not available" message.

![Glacier S3 objects object view](../imgs/catalog-filesbrowser-glacier-objectview.png)
