# Existing package
Start by installing and importing the package you wish to modify:
``` python
import quilt
quilt.install("uciml/wine")
from quilt.data.uciml import wine
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
# insert a dataframe at wine.mygroup.data()
wine._set(["mygroup", "data"], df) 
# insert a file at wine.mygroup.anothergroup.blob()
wine._set(["mygroup", "anothergroup", "blob"], "localpath/file.txt") #
```

Now you can rebuild the package to save the changes and then push the result to Quilt. (Note that only the package owner can modify the package. In the present example you can rebuild the wine package into your own package repository.)

First, log in to quilt:
```
$ quilt login
```

Finally name and push your package:
```python
# build a package based on the current state of wine
quilt.build("YOUR_USERNAME/YOUR_PACKAGENAME", wine)
# push it to the registry.  NOTE: this becomes public and crawlable by Google for example.
quilt.push("YOUR_USERNAME/YOUR_PACKAGENAME", public=True)
```

***
