<!-- markdownlint-disable MD013 -->
# Quilt3 Python Client

Python client library for Quilt data packages.

## Development Setup

This project uses UV for dependency management and poethepoet (poe) for task running.

```bash
# Install dependencies
uv sync

# Activate virtual environment  
source .venv/bin/activate
```

## Available Commands

### Testing

- `uv run poe test` - Run all tests (includes 3 failing session tests)
- `uv run poe test-local` - Run tests excluding failing session tests (recommended for local development)
- `uv run poe test-verbose` - Run tests with verbose output
- `uv run poe test-coverage` - Run tests with coverage report

### Code Quality

- `uv run poe lint` - Run pylint and pycodestyle linters
- `uv run poe format-check` - Check import sorting with isort

### Build

- `uv run poe build` - Build the package using uv
- `uv run poe clean` - Clean build artifacts and cache files

## Notes

The `test-local` command skips the `test_get_boto3_session` tests which require specific AWS configuration and typically fail in local development environments.

## Best Practices

- Always check and fix IDE diagnostics after editing files
- Use `markdownlint-disable MD013` on all newly-created Markdown files, to avoid excessive lint warnings
- After pushing a PR, wait ~5 minutes to check for comments/errors, then address them (resolving comments if outdated)
