# Visualization and Dashboards with Quilt

Quilt packages are not only units of data and metadata, but units of *reporting*.
You can use the following system to include interactive visualizations
and light applications inside of packages.

Importantly, relative references to data are resolved relative to the parent package.
This means that all of your reports are backed by immutable, versioned data, providing
a common frame of reference that is lacking in BI applications that read from
fast-moving databases and file systems.

In addition to natively rendering a wide variety of images, binary files, and text 
files, the Quilt catalog supports Vega, Vega-lite, 


## `quilt_summarize.json`

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

![](../imgs/quilt-summarize-rows.png)

For more sophisticated layouts, you can break a row into columns by providing an
array instead of a string:

```json
// quilt_summarize.json
[
  "file1.json",
  [{
    "path": "file2.csv",
    "width": "200px"
  }, {
    "path": "file3.ipynb",
    "title": "Scientific notebook",
    "description": "[See docs](https://docs.com)"
  }]
]
```
![](../imgs/quilt-summarize-columns.png)

Each element of an array in `quilt_summarize.json` can either be a path string
or an object with one or more of the following properties:
- `path` - file path relative to `quilt_summarize.json`
- `title` - title rendered instead of file path
- `description` - description in markdown format
- `width` - column width either in pixels or ratio (default is ratio `1`)

`quilt_summarize.json` will render in any directory that contains a file of the
same name, in both bucket view and package view.

