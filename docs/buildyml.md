# `build.yml` structure and options
A `build.yml` file specifies the structure, type, and names for package contents.

Below is the general syntax of the `build.yml` file:
``` yaml
contents:
  GROUP_NAME:
    # transform: optional. applies recursively to child nodes. If 'transform'
    #   is omitted, Quilt will select a transform by file extension, falling
    #   back on the "id" transform, which stores the raw data.
    transform:  {id | csv | tsv | ssv | xls | xlsx}
    # kwargs: optional.  applies recursively to child nodes.
    kwargs:
        # Each KEYWORD: VALUE pair is passed directly to the transform function.
        #   For example, with csv this is pandas.read_csv.
        KEYWORD: VALUE  # keyword arguments for transform function/method
    DATA_NAME:
      # file: required.  Relative path from base of package dir.
      file: FILE_PATH
      # transform: optional.  If given, overrides GROUP_NAME's transform.   
      transform: {id, csv, tsv, ssv, xls, xlsx} # optional
      # if transform is omitted, 
      kwargs:  # overrides GROUP_NAME's kwargs for this node.
        KEYWORD: VALUE  # optional. keyword arguments to 
    GLOB_GROUP:     # Container node for nodes created from matching files
      QUOTED_GLOB_PATH:  # standard glob path, such as "*.csv" 
        transform: csv   # set transform for all matched files (optional)
        kwargs:          # set kwargs for all matched files (otional)
          KEYWORD_ARG: VALUE
```

Example `build.yml`:
``` yaml
contents:
  data_example:     # create a node named 'data_example'
    transform: csv  # Read files using csv reader
    kwargs:         # optional
      header:       # optional: no header row
      sep: ","      # optional: set field separator
    child:
      file: data/foo.txt # parsed as CSV, no header
    another_child:
      file: data/bar.txt # parsed as CSV, no header
    child_from_elsewhere:
      # parsed as TSV (from kwargs set here) no header (from parent's kwargs)
      file: data2/bar.txt
        kwargs:
          sep: '\t'  # Use tab as separator.
    glob_example:   # create a node named 'glob example'
      # assuming these files exist: 'somedir/foo.xls', 'somedir/subdir/bar.csv', 'somedir/baz.tsv'
      'somedir/**/*':   # create nodes 'foo', 'bar', and 'baz'
        # matched files parsed as CSV, no header
    glob_example_2:  # create a node named 'glob_example_2'
      # assuming these files exist: 'chars/bella.txt', 'chars/edward.txt', 'chars/old/esme.txt'
      'chars/*.txt':  
        transform: tsv  # create nodes 'bella' and 'edward'    
        # matched files parsed as TSV, no header
```

## Reserved words
* `file` - required for leaf nodes; specifies where source file lives on disk
* `transform` - specifies how the file will be parsed
* `kwargs` - these options are passed through to the parser (usually [`pandas.read_csv`](https://pandas.pydata.org/pandas-docs/stable/generated/pandas.read_csv.html) so that users can skip lines, type columns, specify delimiters, and much more)
* `checks` - experimental data unit tests
* `environments` - experimental environments for `checks`
* `package` - experimental source specifier includes an existing package or sub-package in the build tree (see [Package Composition](compose.md))
* `*?[!]` - any character in this group will initiate glob-style pattern matching

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

## Glob / Wildcard matching
If a string containing wildcards is used as a node name, it will be matched
against the build directory.  The filename of any matching path, minus the
extension, will be used as the nodename. As when specifying a single data node,
`kwargs` and `transform` may be used to specify how the file should be read.

The following standard wildcard strings are accepted:
* `**` - Match current dir and all subdirs, recursively
* `*` - Match any one or more characters
* `?` - Match any single character
* `[X]` (where X is any number of characters) - Match any one character contained in X
* `[!X]` (where X is any number of characters) - Exclude any one character contained in X

All wildcards except `**` act in the current directory alone, so `*` does not match
`subdir/foo/file.ext`, but `subdir/foo/*` and `**/*.ext` do.

If provided, `transform` and any specific `kwargs` are used with each matched file.
Otherwise, the parent (or default) `transform` and `kwargs` will be used.

Finally, if matching results in identical node names, the nodes are renamed in a consistent
manner (paths are sorted lexicographically), and any duplicate names are numbered.  So for
files "foo.txt" and "subdir/foo.txt", the result is "foo" (from foo.txt) and "foo_2" (from
"subdir/foo.txt").  The naming behavior is consistent across platforms.
***

