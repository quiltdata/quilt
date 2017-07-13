# Package editing

In addition to building a new package from source data, Quilt allows editing of an existing package. You can then save changes back to the original package or build a new one.

Start by installing and importing the package:
``` python
import quilt
quilt.install("akarve/wine")
from quilt.data.akarve import wine
```

Use the Pandas API to edit existing dataframes:
``` python
red_df = wine.quality.red._data()
red_df.set_value(0, 'quality', 6)
```
(The `_data()` method caches the dataframe so it will return the same object each time - however, it's not saved to disk yet.)

Use the standard Python syntax to create or delete attributes:
``` python
wine.quality.red2 = wine.quality.red
del wine.quality.red
```

Use the `_set` helper method on the top-level package node to create new groups and data nodes:
``` python
import pandas as pd
df = pd.DataFrame(dict(x=[1, 2, 3]))
wine._set(["group", "df"], df)
assert wine.group.df._data() is df
```

Now, build a modified package to save all of the changes:
``` python
quilt.build("my_user/wine_modified", wine)