# Python
1. Download a data package from  user `uciml`
    ```bash
    $ quilt install uciml/iris
    ```
Every Quilt command is available both on the [command line](./shell.md) and in [Python](./python.md). So you could install a package as follows:

```python
import quilt

quilt.install("uciml/iris")
```

1. Import the package
    ```python
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

That's it. Read more about the `uciml/iris` package on its [landing page](https://quiltdata.com/package/uciml/iris), or [browse  packages on Quilt](https://quiltdata.com/search/?q=).

# PySpark

1. Download a data package from  user `uciml`
    ``` bash
    $ quilt install uciml/iris
    ```
    
1. Import the package
    ```python
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

That's it. Read more about the `uciml/iris` package on its [landing page](https://quiltdata.com/package/uciml/iris), or [browse  packages on Quilt](https://quiltdata.com/search/?q=).



## Forthcoming
* Build packages in PySpark
* Access and build packages in Java and Scala
* We welcome your contributions on [GitHub](https://github.com/quiltdata/quilt).

***
