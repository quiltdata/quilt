Start by installing and importing the package you wish to modify:
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

At this point the package owner can build the package in-place (`quilt.build("akarve/wine", wine`), followed by `quilt.push("akarve/wine")` to update the revision history. Alternatively, if you are not the package owner, you can build the modified packing into a new handle as follows:
``` python
quilt.build("my_user/wine_modified", wine)
```

***
