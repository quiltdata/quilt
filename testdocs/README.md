= Test Documentation

Uses [pytest_codeblocks](https://github.com/nschloe/pytest-codeblocks) to verify documentation code is valid and correct.

== Usage

From inside the `testdocs` directory:

```
$ pip3 install poetry
$ poetry install
$ poetry run black ../docs
$ pushd ../gendocs; python3 build.py; popd
$ poetry run pytest --codeblocks ../docs
$ zsh clean.sh # remove test files
```

== Editing

To edit the walkthrough notebooks and regenerate their markdown:

```
$ poetry run jupyter-lab ../docs
$ pushd ../gendocs; python3 build.py; popd
```
