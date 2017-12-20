# Install latest from `master`
- `pip install git+https://github.com/quiltdata/quilt-compiler.git`

# Local installation
1. `git clone https://github.com/quiltdata/quilt-compiler.git`
1. `cd quilt`
1. From the repository root: `pip install -e .`

## If the path above `setup.py` changes
`pip uninstall` (and over-install) will fail you because pip will be unable to find the path from installation time. You can edit `site-packages/quilt.egg-link`  and `site-packages/easy-install.pth` to fix this issue.

# Testing
- All new modules, files, and functions should have a corresponding test 
- Setup: `pip install pylint pytest pytest-cov`
- `pytest` will run any `test_*` files in any subdirectory
- Code coverage: `python -m pytest --cov=quilt/tools/ --cov-report html:cov_html quilt/test -v`
- View coverage results by opening cov_html/index.html

# Contribute
- Conversation on [gitter](https://gitter.im/quilt-data/Lobby)
- Selected projects are posted to [GitHub Issues](https://github.com/quiltdata/quilt-compiler/issues)
- Contributions welcome on [GitHub](https://github.com/quiltdata/quilt-compiler).

