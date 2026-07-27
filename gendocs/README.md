
# quilt3 Documentation Generator

Generates API documentation for quilt3 using a custom fork of pydoc-markdown.

## Usage

From `api/python`:

```sh
# Generate documentation
uv run poe gendocs

# Check if generated docs are up-to-date
uv run poe gendocs-check
```

From the `gendocs` directory:

```sh
uv run build.py
```

## Configuration

- `pydocmd.yml` - Configuration for pydoc-markdown
- `pyproject.toml` - UV project configuration and dependencies

## Custom pydoc-markdown

Pydoc-markdown ended up being the easiest to modify, and unlike sphinx/napoleon,
wasn't a mixture of google docstrings plus RST, which ended up being pretty
ungainly to work with. Instead, it's a mixture of google docstrings and markdown,
which works a bit better. Also, though the API of pydoc-markdown is less
formalized, implementing changes is also less convoluted than for sphinx.

We use a custom fork of pydoc-markdown
(<https://github.com/quiltdata/pydoc-markdown.git@v2.0.5+quilt3.2>) with these
modifications:

- Include additional __special_methods__ and easily exclude them
- Fix issue reading classmethod/staticmethod signatures
- Use signatures as title, not under title in a code block
- Minor display improvements/preferences
- Handle Google docstrings to render them as markdown
- Fix handling of codeblocks under sections
- Add handling for doctest-style code examples
