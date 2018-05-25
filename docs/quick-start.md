# Quick start

```
$ pip install quilt
$ quilt install uciml/iris
$ python
Python 3.6.3 | packaged by conda-forge | (default, Nov  4 2017, 10:13:32) 
[GCC 4.2.1 Compatible Apple LLVM 6.1.0 (clang-602.0.53)] on darwin
Type "help", "copyright", "credits" or "license" for more information.
>>> from quilt.data.uciml import iris
>>> iris.tables.iris()
     sepal_length  sepal_width  petal_length  petal_width           class
0             5.1          3.5           1.4          0.2     Iris-setosa
1             4.9          3.0           1.4          0.2     Iris-setosa
2             4.7          3.2           1.3          0.2     Iris-setosa
3             4.6          3.1           1.5          0.2     Iris-setosa
4             5.0          3.6           1.4          0.2     Iris-setosa
```
