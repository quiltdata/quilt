# quilt3.admin GraphQL code generation

From the parent directory (`api/python`):

```sh
# Generate GraphQL client
uv run poe gql-gen

# Check if generated code is up-to-date
uv run poe gql-check
```

This will generate GraphQL client in `api/python/quilt3/admin/_graphql_client/` using
GraphQL queries from `queries.graphql`.
