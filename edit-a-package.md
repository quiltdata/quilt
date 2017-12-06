# Existing package
Start by installing and importing the package you wish to modify:
``` python
import quilt
quilt.install("uciml/wine")
from quilt.data.akarve import wine
```

# New package
You can also build packages on the fly:
```python
import pandas as pd
df = pd.DataFrame(data=[1,2,3])
```

## Edit package

Use the Pandas API to edit existing dataframes:
``` python
df = wine.tables.wine()
hue = df['Hue']
df['HueNormalized'] = (hue - hue.min())/(hue.max() - hue.min())
```

Use `del` to delete attributes:
``` python
del wine.raw.wine
```

Use the `_set` helper method on the top-level package node to create new groups and data nodes:
``` python
import pandas as pd
df = pd.DataFrame(dict(x=[1, 2, 3]))
wine._set(["mygroup", "data"], df) # add a dataframe to the package
wine._set(["mygroup", "blob"], "localpath/file.txt") # add a file to the package
```

Now you can rebuild the package to save the changes and then push the result to Quilt. (Note that only the package owner can modify the package. In the present example you can rebuild the wine package into your own package repository.)
```python
quilt.build("USR/PKG", wine)
quilt.push("USR/PKG")
```

***
