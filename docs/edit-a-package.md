# Edit a package

Start by installing and importing the package you wish to modify:
``` python
import quilt
quilt.install("uciml/wine")
from quilt.data.uciml import wine
```

Alternatively, you can  build an empty package and import it for editing:
```python
import quilt
quilt.build("USER/FOO")
from quilt.data.USER import FOO
```

## Editing dataframes
Use the Pandas API to edit existing dataframes:
``` python
df = wine.tables.wine()
hue = df['Hue']
df['HueNormalized'] = (hue - hue.min())/(hue.max() - hue.min())
```

## Add package members
Use the `_set` helper method on the top-level package node to create new groups and data nodes:
``` python
import pandas as pd
df = pd.DataFrame(dict(x=[1, 2, 3]))
# insert a dataframe at wine.mygroup.data()
wine._set(["mygroup", "data"], df) 
# insert a file at wine.mygroup.anothergroup.blob()
wine._set(["mygroup", "anothergroup", "blob"], "localpath/file.txt") #
```

## Delete package members
Use `del` to delete attributes:
``` python
del wine.raw.wine
```

## Edit metadata
Use the `_meta` attribute to attach any JSON-serializable dictionary of metadata to a group or a data node:

``` python
wine.mygroup._meta['foo'] = 'bar'
wine.mygroup._meta['created'] = time.time()
```

Data nodes contain a built-in key `_meta['_system']` with information such as the original file path. You may access it, but any modifications to it may be lost.

## Filter the package

The top-level package node has a `_filter` method that accepts either a dictionary or a lambda.
It returns a new package that has the same tree structure, but contains only the nodes that matched the filter.
If a group matches the filter, its whole subtree is included.

Dictionary filter supports two properies, `name` and `meta`:

``` python
pkg = wine._filter({'name': 'README'})  # Just the readme
pkg = wine._filter({'meta': {'foo': 'bar'}})  # The group we created earlier
pkg = wine._filter({'meta': {'_system': {'transform': 'csv'}}})  # Dataframes created from CSVs
```

Lambda filter accepts the node object and its name. It provides more flexibility, but requires more care when accessing values:

``` python
pkg = wine._filter(lambda node, name: node._meta.get('_system', {}).get('filepath', '').endswith('.data'))
```


## Persist changes
At this point, your changes only exist in memory. To persist your
changes you can [build](./build-a-package.md) and [push](./push-a-package.md)
your package.
