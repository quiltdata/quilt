The examples in this section use the `aleksey/hurdat` [demo package](https://open.quiltdata.com/b/quilt-example/tree/aleksey/hurdat/):


```python
import quilt3
p = quilt3.Package.browse('aleksey/hurdat', 's3://quilt-example')
p
```

    Loading manifest: 100%|██████████| 7/7 [00:00<00:00, 8393.40entries/s]





    (remote Package)
     └─.gitignore
     └─.quiltignore
     └─notebooks/
       └─QuickStart.ipynb
     └─quilt_summarize.json
     └─requirements.txt
     └─scripts/
       └─build.py



## Slicing through a package

Use `dict` key selection to slice into a package tree:


```python
# returns PackageEntry("requirements.txt")
p["requirements.txt"]
```




    PackageEntry('s3://quilt-example/aleksey/hurdat/requirements.txt?versionId=bQtxuZlaylNVHi0GmxkSMofT5qXJvP95')




```python
# returns (remote Package)
p["notebooks"]
```




    (remote Package)
     └─QuickStart.ipynb



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

    Copying objects: 100%|██████████| 36.7k/36.7k [00:01<00:00, 22.7kB/s]
    100%|██████████| 36.7k/36.7k [00:01<00:00, 24.1kB/s]
    Copying objects: 100%|██████████| 39.9k/39.9k [00:02<00:00, 16.5kB/s]





    (local Package)
     └─.gitignore
     └─.quiltignore
     └─notebooks/
       └─QuickStart.ipynb
     └─quilt_summarize.json
     └─requirements.txt
     └─scripts/
       └─build.py



`fetch` will default to downloading the files to the current directory, but you can also specify an alternative path:


```python
p["notebooks"]["QuickStart.ipynb"].fetch("./references/")
```

    100%|██████████| 36.7k/36.7k [00:01<00:00, 22.5kB/s]





    PackageEntry('file:///Users/gregezema/Documents/programs/quilt/docs/Walkthrough/references/')



## Downloading package data into memory

Alternatively, you can download data directly into memory:


```python
p["quilt_summarize.json"].deserialize()
```




    ['notebooks/QuickStart.ipynb']



To apply a custom deserializer to your data, pass the function as a parameter to the function. For example, to load a hypothetical `yaml` file using `yaml.safe_load`:


```python
import yaml
# returns a dict
p["quilt_summarize.json"].deserialize(yaml.safe_load)
```




    ['notebooks/QuickStart.ipynb']



The deserializer should accept a byte stream as input.

## Getting entry locations

You can get the path to a package entry or directory using `get`:


```python
# returns /path/to/pkg/root/notebooks/QuickStart.ipynb
p["notebooks"]["QuickStart.ipynb"].get()
```




    's3://quilt-example/aleksey/hurdat/notebooks/QuickStart.ipynb?versionId=PH.9gsCH6LM9RQIqsy1U4X6H6s.VoQ_B'



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
