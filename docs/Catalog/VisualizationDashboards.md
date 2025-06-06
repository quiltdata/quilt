<!-- markdownlint-disable -->
# Visualization and Dashboards with the Quilt catalog

Quilt packages are not only reproducible units of data and metadata, but units of
*reporting*.  You can use the following features to include interactive visualizations
and light applications inside of packages.

Importantly, relative references to data are resolved relative to the parent package.
This means that all of your reports are backed by immutable, versioned data, providing
a common frame of reference that is lacking in BI applications that read from
fast-moving databases and file systems.

In addition to rendering a wide variety of images, binary files, and text
files, the Quilt catalog supports the following libraries for visualization and
exploration:
* [Vega](#vega-and-vega-lite)
* [Vega-lite](#vega-and-vega-lite)
* [ECharts](#echarts)
* [Voila](#voila) (Developer preview)
* [Perspective](#perspective)
* [IGV](#integrative-genomics-viewer-igv)

The above systems provide you with hundreds of charts out of the box.


## `quilt_summarize.json`
`quilt_summarize.json` is a configuration file that renders one or more dashboard
elements in both Bucket view and Packages view. The contents of `quilt_summarize.json`
are a JSON array of files that you wish to preview in the catalog. Each file may
be represented as a string or, if you wish to provide more configuration, as an
object.

The simplest summary is a list of relative paths to files that you wish to preview:
```json
// quilt_summarize.json
[
  "file1.json",
  "file2.csv",
  "file3.ipynb"
]
```

By default, each list element renders in its own row.

![](../imgs/quilt-summarize-rows.png)

For multi-column layouts, you can provide an array instead of a string for a given
row:

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
- `expand` - Display the file (`true`) or display a preview in an expandable box (`false`, default)
- `width` - column width either in pixels or ratio (default is ratio `1`)
- `types` - a list of render types (at present only singleton lists are supported):
    - `["echarts"]` to render JSON as an EChart
    - `["perspective"]` to render tabular data (csv, xlsx etc.) with Perspective
    - `["igv"]` to render JSON with Integrative Genomics Viewer
    - `["voila"]` to render a Jupyter notebook as an interactive Voila dashboard
    - `["html"]` to render HTML in iframes. See also [Advanced HTML rendering](./Preview.md#advanced-html-rendering-and-quilt-package-file-server)
    - `["text"]` to render anything as text with syntax highlighting

If you need to control the height of an element (useful for Voila dashboards),
use the following extended syntax:

```json
// quilt_summarize.json
[
  {
    "path": "file1.json",
    "types": [
      {
        "name": "echarts",
        "style": { "height": "1000px" }
      }
    ]
  }
]
```

At present `height` is the only supported `style` element.

> Limitations:
> * Objects linked via `quilt_summarize.json` are always the
>   **latest** version, even when browsing an older package version.
> * Object titles and image thumbnails link to the file view, even in
>   the package view.

## Images

If your Amazon S3 bucket contains images, by default the Quilt 
Catalog displays a preview of those images _before_ any 
`quilt_summarize.json`-referenced files.

In the **Overview** tab, the Catalog parses the entire Amazon S3 
bucket contents and displays thumbnail image previews in a 
paginated grid (25 per page by default) of 
all [supported image types](../Catalog/Preview.md#binary-and-special-file-format-previews).

> To hide this block, use the `gallery` field in
your [bucket preferences](./Preferences.md) file.

In the **Bucket** tab, the Catalog displays thumbnail image 
previews in a similarly paginated grid but _only from the current 
directory viewed_.

In the **Packages** tab, when a specific package has been 
opened the Catalog displays thumbnail image previews in a 
similarly paginated grid but _only those image files in the selected package_.

## Vega and Vega-lite
The Quilt catalog uses [vega-embed](https://github.com/vega/vega-embed) to render
[vega](https://vega.github.io/vega/) and [vega-lite](https://vega.github.io/vega-lite/) visualizations.
See [package.json](https://github.com/quiltdata/quilt/blob/master/catalog/package.json)
for specific library versions and compatibility.

In order to display a Vega or Vega-Lite visualization, simply reference a JSON
file with a library-compatible schema in a JSON file as follows in your
`quilt_summarize.json` file:

```json
[
    "relative/path/to/my/vega.json",
    "optionally/some/other/file.csv"
]
```

For both Vega and Vega Lite you may specify relative paths to package files
as data sources and the Quilt catalog correctly resolves them. Vega treats any
data source as JSON by default. If you wish to use a different format than JSON, please 
[specify the file type](https://vega.github.io/vega-lite/docs/data.html#format).
For example: 

```json
{
  "data": {
    "url": "./datasource.csv",
    "format": {
      "type": "csv"
    }
}
```

### Altair
The easiest way to create Vega-lite visualizations for Quilt packages is with
[Altair](https://altair-viz.github.io/).

Here's a simple example:
```python
import pandas as pd
from numpy import random
import altair as alt

# Create Dataframe with two columns of random values
scores = random.randint(60, 100, size=5)
densities = random.random_sample(5)
df = pd.DataFrame({'score': scores, 'density': densities})

# Create Chart with two Quantitative axes

alt.Chart(df).mark_area(
    color="gray",
    opacity=.2
).encode(
    x="score:Q",
    y='density:Q',
    tooltip=['count(score):Q']
).save("vega.json")
```

> To create plots that directly embed a dataset with more than 5000
rows (a large dataset), you will encounter a `MaxRowsError`. You
can get around this error in [several different
ways](https://altair-viz.github.io/user_guide/faq.html#maxrowserror-how-can-i-plot-large-datasets)

### Live packages
- [Interactive map of California with slider
scale](https://open.quiltdata.com/b/quilt-example/packages/akarve/reef-check)
- [Interactive map of 2015 United States by-county smoking & poverty
data](https://open.quiltdata.com/b/quilt-example/packages/robnewman/us_county_smoking_vs_poverty)

## ECharts
To render an [EChart](https://echarts.apache.org/), you provide a JSON file (a dictionary that
specifies the ECharts [option parameter](https://echarts.apache.org/en/option.html))
and you set the `"types"` property to `[ "echarts" ]`.

```json
// quilt_summarize.json
[
  {
    "path": "echarts-option-file.json",
    "title": "Awesome line chart",
    "types": ["echarts"]
  }
]
```

### Example

The following example is a
[simple line chart from the ECharts documentation](https://echarts.apache.org/examples/en/editor.html?c=line-simple).

```json
// echarts.json
{
  "dataset": {
    "source": [
      ["Mon", 150],
      ["Tue", 230],
      ["Wed", 224],
      ["Thu", 218],
      ["Fri", 135],
      ["Sat", 147],
      ["Sun", 250]
    ]
  },
  "xAxis": {
    "type": "category"
  },
  "yAxis": {
    "type": "value"
  },
  "series": [
    {
      "type": "line"
    }
  ]
}
```

![](../imgs/catalog_echarts.png)

### External files

As with Vega, you can provide either a relative path or URL to the dataset file.

```json
// echarts.json
{
  "dataset": {
    "source": "./dataset.csv"
  },
  "xAxis": {
    "type": "category"
  },
  "yAxis": {
    "type": "value"
  },
  "series": [
    {
      "type": "line"
    }
  ]
}
```

Relative paths are resolved relative to your echarts.json file and relative to the
parent package.

### Limitations

At present, ECharts in Quilt does not support custom JavaScript. You are therefore
limited to JSON types (numbers, strings, objects, arrays, etc.). Functions like [`symbolSize`](https://echarts.apache.org/en/option.html#series-scatter.symbolSize)
are not available.

### Live packages
- [Various EChart types](https://open.quiltdata.com/b/quilt-example/packages/examples/echarts)

## Voila
*This feature is a Developer preview, details are subject to change.*

Enterprise deployments of Quilt support interactive Jupyter notebooks
with [Voilà](https://github.com/voila-dashboards/voila).

In brief, a Voila dashboard version of your notebook will
display all of the output cells and none of the input cells from the underlying
notebook. This enables you to create interactive, Jupyter-driven apps for your
Quilt catalog users.

The Voila libraries execute a remote Jupyter Kernel and stream the results to the
browser with tornado. Jupyter kernels run on a single EC2 instance (`t3.small` by default)
in Linux containers that have network access but do not have access to persistent
storage. The catalog users's AWS credentials are passed to Jupyter kernel as
[environment variables](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html#envvars-list).

### Environment variables
When you have a Voila dashboard inside of a Quilt package, you may wish to reference files
*in the current package revision*. The Quilt catalog sets the following environment variables
and passes them to the Voila kernel:

* `QUILT_PKG_BUCKET`
* `QUILT_PKG_NAME`
* `QUILT_PKG_TOP_HASH`

You can access these variables in Python and browse the package:
```python
import io
import os

import pandas as pd
import quilt3 as q3
# https://open.quiltdata.com/b/allencell/packages/aics/data_handoff_4dn/tree/260c3a46581a324e3a495570886e07b62cb4ff54f20b334c5d73a5a370e678c1/

bucket = os.environ.get("QUILT_PKG_BUCKET") or "allencell"
handle = os.environ.get("QUILT_PKG_NAME") or "aics/data_handoff_4dn"
top_hash = os.environ.get("QUILT_PKG_TOP_HASH") or "260c3a46581a324e3a495570886e07b62cb4ff54f20b334c5d73a5a370e678c1"

pkg = q3.Package.browse(handle, registry=f"s3://{bucket}", top_hash=top_hash)
# Read data.csv from the current package from Voila
df = pkg["metadata.csv"].deserialize()
```


### Included Python packages
By default, Quilt Voila containers provide the following modules:
```
altair
bqplot
ipykernel
ipyvolume
ipywidgets
pandas
perspective-python
PyYAML
quilt3
scipy
```

## Perspective

Quilt renders tabular data formats into a [Perspective](https://perspective.finos.org/) Datagrid, including the
following file extensions: .csv, .xls, .xlsx, .jsonl, .parquet, and .tsv.

For speed, Quilt loads the first few rows stored in S3. Click Load More to fetch
up to about 6MB of zipped data. To see the entire file contents for large files,
download the file (lower left).

### Filter, plot, pivot

Click Filter and Plot to open the side drawer. Drag and drop columns from the sidebar
to Group By, Split By, Order By, and Where to pivot, filter, and more.

![](../imgs/perspective-groupby.png)

Select from a variety for visualizations by clicking the upper left menu that
initially displays "Datgrid".

![](../imgs/perspective-plot.png)

Click Toggle Theme to use a fixed-width font (useful for comparing strings).

Use the controls along the bottom to reset, download, copy, resize the grid, and more.

### Saving and configuring the datagrid

To open the drawer by default, set the `config.settings` property
in `quilt_summarize.json` as follows:

```json
// quilt_summarize.json
[
  {
    "path": "file1.csv",
    "types": [
      {
        "name": "perspective",
        "config": {
          "settings": true
        }
      }
    ]
  }
]
```

You can save the state of the datagrid, as shown below. To restore a saved datagrid
use the `config` property of `quilt_summarize.json`:

![](../imgs/perspective-save.png)

All filters and columns will be restored:

```json
// quilt_summarize.json
[
  {
    "path": "file1.csv",
    "types": [
      {
        "name": "perspective",
        "config": {
          "columns": ["YOUR_COLUMN_0", "YOUR_COLUMN_1"],
          "group_by": ["YOUR_COLUMN_1"],
          "settings": true,
          "theme": "Material Light Mono"
        }
      }
    ]
  }
]
```

### Known issues

Several customers have reported that Perspective Datagrids fail to
automatically render in the Quilt web catalog. We have isolated
this problem to clashes with third party browser extensions in both
Mozilla Firefox and Google Chrome. At least one extension, [Zotero
Connector](https://chrome.google.com/webstore/detail/zotero-connector/ekhagklcjbdpajgpjgmbionohlpdbjgc?hl=en),
has been reported and the error reproduced.

If you encounter a rendering error, please first try a different browser (Firefox,
Safari, Edge) on the same machine. If the error persists, next disable all third-party
extensions, turning each one back on, one-by-one, until the problem
extension is identified. Please then notify
[support@quiltdata.io](mailto:support@quiltdata.io) with the extension
name and version.

### Live packages
- [CSV file automatically rendered in Perspective Datagrid](https://open.quiltdata.com/b/quilt-example/packages/examples/smart-report)

## Integrative Genomics Viewer (IGV)

To render genome tracks, you can select "View as IGV" in the catalog,
or you can invoke [igv.js](https://igv.org/) in quilt_summarize, as shown below:

```json
// quilt_summarize.json
[
  {
    "path": "igv-options-file.json",
    "title": "Awesome genome",
    "types": ["igv"]
  }
]
```

In the above example, `igv-options-file.json` is an
[IGV browser configuration](https://github.com/igvteam/igv.js/wiki/Browser-Creation#browser-configuration-options).

You may specify relative paths to package files or absolute S3 URLs as data sources, and the Quilt catalog will resolve them.
HTTP URLs will remain unchanged.

**Note: Please be mindful of rendering large sequences**
You can limit the downloaded file size of the sequence by using the [`visibilityWindow` parameter](https://github.com/igvteam/igv.js/wiki/Tracks-2.0#options-for-all-track-types)
(`-1` is for downloading the whole file, which could potentially
be several gigabytes in size - this may impact 
rendering speed and interactive performance).

Note that tracks are
[grouped by type and file format](https://github.com/igvteam/igv.js/wiki/Tracks-2.0).

```json
// igv-options-file.json
{
  "tracks": [{
    "name": "Absolute URL track",
    "url": "s3://bucket/file" // will be resolved
  }, {
    "name": "Relative path track",
    "url": "./file" // will be resolved
  }, {
    "name": "HTTP URL track",
    "url": "https://some-url-even-url-to-s3-file" // will stay intact
  }]
}
```

### Live packages
- [Single and multiple track genome sequences](https://open.quiltdata.com/b/quilt-example/tree/examples/simple-igv/) 
