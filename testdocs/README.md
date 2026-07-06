# Test Documentation

Uses [pytest_codeblocks](https://github.com/nschloe/pytest-codeblocks) to verify
documentation code is valid and correct.

## Usage

From `api/python`:

```sh
# Test documentation code blocks
uv run poe testdocs
```

From the `testdocs` directory:

```sh
# Test documentation code blocks
uv run pytest --codeblocks ../docs

# Clean up test files
./clean.sh
```
