# Questions?
Chat with us via intercom on [quiltdata.com](https://quiltdata.com).

# Jupyter, Virtual environments, `quilt` not found
When working with virtual environments like `conda create`, `jupyter` can be installed in the `root` environment. If you then install and run `quilt` in another environment, `foo`, Jupyter will not be able to find quilt.

## Solution
Install `quilt` in the `root` environment, or install Jupyter in `foo` (run `which jupyter` in Jupyter's Terminal to ensure that you're using the environment local Jupyter).