# Questions?
Chat with us via the orange icon intercom on [quiltdata.com](https://quiltdata.com). We can also invite you to our Slack channel.

# `ImportError` on import of data pacakge
Ensure that that the package has been installed via `quilt install` and is available in either the current working directory or one of its ancestors. `from quilt.data.foo import bar` will look for `foo.bar` starting in the current working directory, then the parent directory, then the grandparent directory..., until it finds the first match or fails at the root of the directory tree.


# Jupyter, virtual environments, `quilt` not found
When working with virtual environments like `conda create`, `jupyter` can be installed in the `root` environment. If you then install and run `quilt` in another environment, `foo`, Jupyter will not be able to find quilt.

## Solutions
Install `quilt` in the `root` environment, or install Jupyter in `foo` (run `which jupyter` in Jupyter's Terminal to ensure that you're using the environment local Jupyter).

Alternatively, `pip install quilt` from Jupyter's Terminal.

# pandas `index_col`
This keyword argument should be temporarily avoided in `build.yml` as it causes `pyarrow` to hiccup on serialization.

# Exception when installing `quilt` on OS X El Capitan

`pip` may try to upgrade `pyOpenSSL`, and fail with the following exception when removing the old version of the package:
```
OSError: [Errno 1] Operation not permitted: '/tmp/pip-zFP4QS-uninstall/System/Library/Frameworks/Python.framework/Versions/2.7/Extras/lib/python/pyOpenSSL-0.13.1-py2.7.egg-info'
```

This problem is not specific to `quilt`, and is caused by outdated packages in OS X. See [this stackoverflow question](https://stackoverflow.com/questions/31900008/oserror-errno-1-operation-not-permitted-when-installing-scrapy-in-osx-10-11) for more information.

## Solutions
- Use a virtual environment such as [`conda`](https://conda.io/docs/installation.html) or [`virtualenvwrapper`](https://virtualenvwrapper.readthedocs.io/en/latest/)
- Upgrade `pyOpenSSL` using `brew` or `easy_install`
- Upgrade to a more recent version of OS X

# Website doesn't refresh
It's often helpful to do a hard reload (Shift + Reload on Chrome). Or, sad to say this in 2017, restart your browser. Quilt uses an offline web service worker that, due to circumstances beyond our control, aggressively caches JavaScript assets and network requests.

***