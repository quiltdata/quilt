1. Open Terminal

1. Install Quilt (Python 2.7 or 3.5 recommended; [Known Issues](https://github.com/quiltdata/quilt/blob/master/README.md#known-issues))
    ```bash
    $ pip install quilt
    ```
    (Or if you want the latest, install from GitHub `pip install git+https://github.com/quiltdata/quilt.git`)

1. Install a public data package, [examples/wine](https://quiltdata.com/package/examples/wine)
    ```bash
    $ quilt install examples/wine
    ```

1. Explore the package
    ```python
    $ python
    >>> from quilt.data.examples import wine
    >>> wine.quality.red # this is a pandas.DataFrame
    ```

See the [tutorial](https://github.com/quiltdata/quilt/blob/master/README.md) for more.