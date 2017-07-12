# Questions?
Chat with us via intercom on [quiltdata.com](https://quiltdata.com).

# Jupyter
## Virtual environments, `quilt` not found
When working with virtual environments like `conda create`, `jupyter` can be installed in the `root` environment. If you then install and run `quilt` in another environment, `foo`, Jupyter will not be able to find quilt.

**Solution** Install `quilt` in the `root` environment or install Jupyter in `foo` (and ensure, with `which jupyter` that the environment local Jupyter is in fact in use).