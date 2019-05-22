The examples in this section use the following mock package:

```python
import t4
p = (t4.Package()
        .set("trades.parquet", "trades.parquet")
        .set("symbols.yaml", "symbols.yaml")
        .set("commodities/gold.csv", "gold.csv")
        .set("commodities/silver.csv", "silver.csv")
    )
```

## Slicing through a package

Use `dict` key selection to slice into a package tree:

```bash
$ python
>>> p["trades.parquet"]
<<< PackageEntry("trades.parquet")

>>> p["commodities"]
<<< gold.csv
    silver.csv
```

Slicing into a `Package` directory returns another `Package` rooted at that subdirectory. Slicing into a package entry returns an individual `PackageEntry`.

## Downloading package data to disk

To download a subset of files from a package directory to a `dest`, use `fetch`:

```python
# download a subfolder
p["commodities"].fetch()

# download a single file
p["commodities"]["gold.csv"].fetch()

# download everything
p.fetch()
```

`fetch` will default to downloading the files to the current directory, but you can also specify an alternative path:

```python
p["commodities"]["gold.csv"].fetch("./data/trade/gold.csv")
```

## Downloading package data into memory

Alternatively, you can download data directly into memory:

```bash
$ python
>>> p["commodities"]["gold.csv"]()
<<< <pandas.DataFrame object at ...>
```

To apply a custom deserializer to your data, pass the function as a parameter to the function. For example, to load a `yaml` file using `yaml.safe_load`:

```bash
$ python
>>> p["symbols.yaml"](yaml.safe_load)
<<< {'gold': 'au', 'silver': 'ag'}
```

The deserializer should accept a byte stream as input.

## Getting entry locations

You can get the path to a package entry or directory using `get`:

```python
p["commodities"]["gold.csv"].get()

# returns /path/to/workdir/commodities/gold.csv

p.get()
# returns /path/to/workdir/
```

## Getting metadata

Metadata is available using the `meta` property.

```python
# get entry metadata
p["commodities"]["gold.csv"].meta

# get directory metadata
p["commodities"].meta

# get package metadata
p.meta
```
