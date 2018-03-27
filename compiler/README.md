
![PyPI - Python Version](https://img.shields.io/pypi/pyversions/quilt.svg)

(Python 2.7 not supported on Windows)

# Quilt compiler
The compiler parses and serializes data (`build`). It also communicates with the registry during `push` and `install` events.

## Developer
```
git clone https://github.com/quiltdata/quilt-compiler.git
cd quilt # repository root
pip install -e compiler
pip install -e compiler[tests]
```

### If the path above setup.py changes
`pip uninstall` (and over-install) will fail you because pip will be unable to find the path from installation time.
You can edit site-packages/quilt.egg-link and site-packages/easy-install.pth to fix this issue.

### Testing
All new modules, files, and functions should have a corresponding test.
`pytest` will run any test_* files in any subdirectory

#### Code coverage
```
python -m pytest --cov=quilt/tools/ --cov-report html:cov_html quilt/test -v
```

View coverage results by opening cov_html/index.html
