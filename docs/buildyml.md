# `build.yml` structure and options
Below is a sample `build.yml` file. `build.yml` specifies the structure, type, and names for package contents.

``` yaml
contents:
  GROUP_NAME:
    DATA_NAME:
      file: PATH_TO_FILE # required
      transform: {id, csv, tsv, ssv, xls, xlsx} # optional
      # if transform is omitted, Quilt will attempt to find a transform from the file extension, falling back on transform: id, which copies raw data
      kwargs: # these are handed to pandas during build
        sep: "\t" # optional; implies tab-separated values
        KEYWORD_ARG: VALUE # optional
      # Any key-word argument to pandas.read_csv works as a child of DATA_NAME
    ANOTHER_GROUP_NAME:
      transform: csv # set transform for all sub-children
      kwargs:
        header: # there's no header row
      child:
        file: data/foo.txt # parsed as CSV, no header
      another_child:
        file: data/bar.txt # parsed as CSV, no header
```
## Reserved words
* `file` - required for leaf nodes; specifies where source file lives on disk
* `transform` - specifies how the file will be parsed
* `kwargs` - these options are passed through to the parser (usually [`pandas.read_csv`](https://pandas.pydata.org/pandas-docs/stable/generated/pandas.read_csv.html) so that users can skip lines, type columns, specify delimiters, and much more)
* `checks` - experimental data unit tests
* `environments` - experimental environments for `checks`

`transform` and `kwargs` can be provided at the group level, in which case they apply to all descendants until and unless overridden.

## Column types
By default, `quilt build` converts some file types (e.g., csv, tsv) to Pandas DataFrames using `pandas.read_csv`. Sometimes, usually due to columns of mixed types, pandas will throw an exception during `quilt build`. In such cases it's helpful to include column types in `build.yml` by adding a `dtype` parameter:

```yaml
  contents:
    iris:
      file: iris.data
      transform: csv
      header: null
      dtype:
        sepal_length: float
        sepal_width: float
        petal_length: float
        petal_width: float
        class: str
```

`dtype` takes a dict where keys are column names and values are valid Pandas column types:
* int
* bool
* float
* complex
* str
* unicode
* buffer

See also [dtypes](https://docs.scipy.org/doc/numpy/reference/arrays.dtypes.html).

***

