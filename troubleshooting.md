# Questions?
Chat with us via the orange icon intercom on [quiltdata.com](https://quiltdata.com). We can also invite you to our Slack channel.

# Jupyter, virtual environments, `quilt` not found
When working with virtual environments like `conda create`, `jupyter` can be installed in the `root` environment. If you then install and run `quilt` in another environment, `foo`, Jupyter will not be able to find quilt.

## Solution
Install `quilt` in the `root` environment, or install Jupyter in `foo` (run `which jupyter` in Jupyter's Terminal to ensure that you're using the environment local Jupyter).

# pandas `index_col`
This keyword argument should be temporarily avoided in `build.yml` as it causes `pyarrow` to hiccup on serialization.

# Exception when installing `quilt` on OS X El Capitan

`pip` may try to upgrade `pyOpenSSL`, and fail with the following exception when removing the old version of the package:
```
OSError: [Errno 1] Operation not permitted: '/tmp/pip-zFP4QS-uninstall/System/Library/Frameworks/Python.framework/Versions/2.7/Extras/lib/python/pyOpenSSL-0.13.1-py2.7.egg-info'
```

## Solutions
- Use a virtual environment such as [`conda`](https://conda.io/docs/installation.html) or [`virtualenvwrapper`](https://virtualenvwrapper.readthedocs.io/en/latest/)
- Upgrade `pyOpenSSL` using `brew` or `easy_install`
- Upgrade to a more recent version of OS X
