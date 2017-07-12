# Python
1. Download a data package from  user `uciml`
    ``` bash
    $ quilt install uciml/iris
    ```

1. Import the package in Python
    ``` python
    $ python
    >>> from quilt.data.uciml import iris
    >>> iris
    <PackageNode 'Users/YOU/quilt_packages/uciml/iris'>
    raw/
    tables/
    README
    >>> iris.tables.bezdek_iris() # this is a pandas DataFrame
       sepal_length  sepal_width  petal_length  petal_width  label
    0  5.1           3.5          1.4           0.2          Iris-setosa
    1  4.9           3.0          1.4           0.2          Iris-setosa
    2  4.7           3.2          1.3           0.2          Iris-setosa
    ...
    ```

That's it. Read more about the `uciml/iris` on its [package landing page](https://quiltdata.com/package/uciml/iris), or [browse  packages on Quilt](https://quiltdata.com/search/?q=).

# PySpark

1. Download a data package from  user `uciml`
    ``` bash
    $ quilt install uciml/iris
    ```
    
1. Import the package:
```python
$ pyspark
>>> from quilt.data.uciml import iris
>>> sales
<GroupNode '/Users/dsci/quilt_packages/akarve/sales':''>
README
transactions
>>> sales.transactions._data() # this is a Spark DataFrame
      Row ID  Order ID Order Date Order Priority  Order Quantity       Sales  \
0          1         3 2010-10-13            Low               6    261.5400   
1         49       293 2012-10-01           High              49  10123.0200   
2         50       293 2012-10-01           High              27    244.5700   
3         80       483 2011-07-10           High              30   4965.7595
```

## Coming soon
We plan to add support for building packages in PySpark and support
for accessing and building packages in Java and Scala. To
contribute, find our code on [GitHub] (https://github.com/quiltdata/quilt).