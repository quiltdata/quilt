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

## Commit changes
Now you can rebuild the package to save the changes and then push the result to Quilt.

Note: only the package owner can modify the package. In the present example you can rebuild the wine package into your own package repository.)

```python
# build a package based on the current state of wine
quilt.build("YOUR_USERNAME/YOUR_PACKAGENAME", wine)
```
At this point, the package has been built locally. If you wish to share your
changes with others, or back up your changes remotely, you can now [push your package](./push-a-package.md).