# Test Documentation

Uses [pytest_codeblocks](https://github.com/nschloe/pytest-codeblocks) to verify documentation code is valid and correct.

## Usage

From inside the `testdocs` directory:

```
$ pip3 install poetry
$ poetry install
$ poetry run pytest --codeblocks ../docs
$ zsh clean.sh # remove test files
```
