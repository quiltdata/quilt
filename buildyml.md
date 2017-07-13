
# `build.yml` structure and options
See the [Tutorial](https://blog.ycombinator.com/data-packages-for-fast-reproducible-python-analysis/) for details on `build.yml`.
``` yaml
contents:
  GROUP_NAME:
    DATA_NAME:
      file: PATH_TO_FILE
      transform: {id, csv, tsv, ssv, xls, xlsx}
      sep: "\t" # tab separated values
      # or any key-word argument to pandas.read_csv (http://pandas.pydata.org/pandas-docs/stable/generated/pandas.read_csv.html)
```



## Pandas Types
By default, `quilt build` converts some file types (e.g., csv, tsv) to Pandas DataFrames using `pandas.read_csv`. Some files break Pandas type guessing throwing exceptions. In that case, it's often helpful to include column types in build.yml by adding a `dtype` parameter:

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

See [dtypes](https://docs.scipy.org/doc/numpy/reference/arrays.dtypes.html).
