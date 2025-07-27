# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Quilt Python SDK.

## Project Overview

The Quilt Python SDK (`quilt3`) is a Python library that provides programmatic access to the Quilt data lakehouse platform. It enables users to create, version, push, and install data packages, manage S3 buckets, and interact with the Quilt catalog from Python scripts and applications.

## Development Setup

```bash
pip install -e .[tests]       # Install for development with test dependencies
pip install -e .[pyarrow]     # Install with PyArrow support for data formats
pip install -e .[catalog]     # Install with local catalog server support
make install-local            # Alternative installation method
```

## Testing

```bash
pytest --disable-warnings     # Run all tests
make test                      # Alternative test command
pytest tests/test_api.py       # Run specific test file
pytest -k "test_function_name" # Run specific test
```

## Code Organization

- `quilt3/` - Main package source code
  - `__init__.py` - Package exports and main API
  - `api.py` - Core API functions (search, copy, delete, etc.)
  - `packages.py` - Package class and package management
  - `bucket.py` - Bucket class for S3 operations
  - `session.py` - Authentication and session management
  - `backends/` - Storage backend implementations (S3, local)
  - `admin/` - Administrative API and GraphQL client
  - `workflows/` - Workflow configuration and validation
- `tests/` - Test suite with pytest configuration
- `setup.py` - Package configuration and dependencies

## Core Architecture

### Main Classes
- **Package** - Represents a versioned data package with files and metadata
- **Bucket** - Interface for browsing and managing S3 buckets
- **Admin API** - Administrative functions for user/role management

### Key Modules
- `api.py` - High-level functions like `search()`, `copy()`, `list_packages()`
- `data_transfer.py` - File upload/download and transfer optimization
- `session.py` - Authentication with AWS and Quilt services
- `util.py` - Shared utilities and helper functions

### Backend System
- Pluggable storage backends in `backends/`
- S3 backend handles AWS S3 operations
- Local backend for filesystem operations
- Package registry abstraction for different storage types

## Authentication and Configuration

The SDK handles authentication through:
- AWS credentials (boto3 session)
- Quilt service authentication tokens
- Configuration stored in user's home directory
- Environment variable overrides

## Package Management

### Creating Packages
```python
import quilt3
pkg = quilt3.Package()
pkg.set("data.csv", "path/to/file.csv")
pkg.push("username/packagename", registry="s3://bucket")
```

### Installing Packages
```python
pkg = quilt3.Package.install("username/packagename", registry="s3://bucket")
```

## Testing Patterns

- Tests use pytest with configuration in `pytest.ini`
- Mock AWS services and HTTP calls using `responses` library
- Test data stored in `tests/data/` directory
- Integration tests in `tests/integration/`
- Disable telemetry in tests via environment variable

## CLI Interface

The package provides a command-line interface through `main.py`:
- Entry point: `quilt3` command
- Subcommands for package operations, authentication, catalog browsing
- JSON argument parsing for complex parameters

## Dependencies

Core dependencies:
- `boto3` - AWS SDK for S3 operations
- `requests` - HTTP client for API calls
- `jsonschema` - Schema validation
- `pydantic` - Data validation and settings
- `tqdm` - Progress bars for long operations

Optional dependencies:
- `pandas`, `pyarrow` - Data format support
- `anndata` - AnnData format support for scientific data

## Common Development Tasks

### Adding New API Functions
1. Add function to `api.py` or appropriate module
2. Update `__init__.py` exports
3. Add tests in `tests/test_api.py`
4. Update CLI interface in `main.py` if needed

### Adding New Backends
1. Create new backend class in `backends/`
2. Implement required interface methods
3. Register backend in `backends/__init__.py`
4. Add backend-specific tests

### Working with Package Format
- Packages are represented as manifests (JSON metadata)
- Files are referenced by logical keys and S3 paths
- Metadata can be attached at package and file levels
- Checksums ensure data integrity