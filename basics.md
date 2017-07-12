# Developer
- `pip install pylint pytest pytest-cov`
- `pytest` will run any `test_*` files in any subdirectory
- All new modules, files, and functions should have a corresponding test 
- Track test code coverage by running: `python -m pytest --cov=quilt/tools/ --cov-report html:cov_html quilt/test -v`
- View coverage results by opening cov_html/index.html

## Install latest from `master`
- `pip install git+https://github.com/quiltdata/quilt.git`

## Local installation
1. `git clone https://github.com/quiltdata/quilt.git`
1. `cd quilt`
1. From the repository root: `pip install -e .`