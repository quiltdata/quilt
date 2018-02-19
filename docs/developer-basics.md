# Install latest client (compiler) from `master` on GitHub
```
pip install git+https://github.com/quiltdata/quilt.git#subdirectory=compiler
```

# Clone for local registry, compiler, or catalog development
- Registry dev (see also [registry README](https://github.com/quiltdata/quilt/blob/master/registry/README.md))
- Catalog dev (see also [catalog README](https://github.com/quiltdata/quilt/blob/master/catalog/README.md))
- Compiler dev
    ```sh
    git clone https://github.com/quiltdata/quilt-compiler.git
    cd quilt # repository root
    pip install -e compiler
    ```

## If the path above `setup.py` changes
`pip uninstall` (and over-install) will fail you because pip will be unable to find the path from installation time. You can edit `site-packages/quilt.egg-link`  and `site-packages/easy-install.pth` to fix this issue.

# Testing
- All new modules, files, and functions should have a corresponding test 
- Setup: `pip install pylint pytest pytest-cov`
- `pytest` will run any `test_*` files in any subdirectory
- Code coverage: `python -m pytest --cov=quilt/tools/ --cov-report html:cov_html quilt/test -v`
- View coverage results by opening cov_html/index.html

## Self-hosted registries
See the [registry README](../registry/README.md) for more.

# Contribute
- Conversation on [gitter](https://gitter.im/quilt-data/Lobby)
- Selected projects are posted to [GitHub Issues](https://github.com/quiltdata/quilt/issues)
- Contributions welcome on [GitHub](https://github.com/quiltdata/quilt).

