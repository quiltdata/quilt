The examples in this section use the `aleksey/hurdat` [demo package](https://open.quiltdata.com/b/quilt-example/tree/aleksey/hurdat/):

```python
# import quilt3
# p = quilt3.Package.browse('aleksey/hurdat', 's3://quilt-example')
(remote Package)
 └─.gitignore
 └─.quiltignore
 └─notebooks/
   └─QuickStart.ipynb
 └─quilt_summarize.json
 └─requirements.txt
 └─scripts/
   └─build.py
```

## Slicing through a package

Use `dict` key selection to slice into a package tree:

```python
p["requirements.txt"]
# returns PackageEntry("requirements.txt")

p["notebooks"]
# returns:
# (remote Package)
# └─QuickStart.ipynb
```

Slicing into a `Package` directory returns another `Package` rooted at that subdirectory. Slicing into a package entry returns an individual `PackageEntry`.

## Downloading package data to disk

To download a subset of files from a package directory to a `dest`, use `fetch`:

```python
# download a subfolder
p["notebooks"].fetch()

# download a single file
p["notebooks"]["QuickStart.ipynb"].fetch()

# download everything
p.fetch()
```

`fetch` will default to downloading the files to the current directory, but you can also specify an alternative path:

```python
p["notebooks"]["QuickStart.ipynb"].fetch("./references/")
```

## Downloading package data into memory

Alternatively, you can download data directly into memory:

```bash
p["quilt_summarize.json"]()
# returns a dict
```

To apply a custom deserializer to your data, pass the function as a parameter to the function. For example, to load a hypothetical `yaml` file using `yaml.safe_load`:

```python
p["symbols.yaml"](yaml.safe_load)
# returns a dict
```

The deserializer should accept a byte stream as input.

## Getting entry locations

You can get the path to a package entry or directory using `get`:

```python
p["notebooks"]["QuickStart.ipynb"].get()
# returns /path/to/pkg/root/notebooks/QuickStart.ipynb

p.get()
# returns /path/to/pkg/root/
```

## Getting metadata

Metadata is available using the `meta` property.

```python
# get entry metadata
p["notebooks"]["QuickStart.ipynb"].meta

# get directory metadata
p["notebooks"].meta

# get package metadata
p.meta
```
