<!-- markdownlint-disable MD013 -->
# GraphQL Code Generation

This package contains the GraphQL code generation infrastructure for the Quilt3 API.

## Purpose

This shared GraphQL client generation setup allows both the admin package and future GraphQL features (like package search) to use the same generated client code.

## Code Generation

To generate the GraphQL client code:

```bash
cd api/python
make graphql-codegen
```

This will:

1. Install the required dependencies (`ariadne-codegen` and related packages)
2. Generate GraphQL client code in `../quilt3/_graphql_client/`

## Files

- `pyproject.toml` - ariadne-codegen configuration
- `queries.graphql` - GraphQL queries and mutations
- `requirements.txt` - Python dependencies for code generation
- `base_client.py` - Base client class
- `exceptions.py` - GraphQL exceptions

## Generated Output

The generated code is placed in `/api/python/quilt3/_graphql_client/` and includes:

- Client classes for each GraphQL operation
- Type definitions and enums
- Input types for mutations
- Fragment definitions

## Dependencies

- GraphQL schema: `../../../shared/graphql/schema.graphql`
- Target package: `../quilt3/_graphql_client`

## Usage

The admin package imports the generated client:

```python
from .._graphql_client import Client, UserInput, etc.
```
