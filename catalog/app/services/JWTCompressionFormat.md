# JWT Compression Format

This document describes the compression format used in the enhanced JWT tokens to stay under the 8KB limit and the parallel expanded fields that are now shipped for convenience.

## Field Abbreviations

The JWT payload uses shortened field names to save space:

- `s` = scope (e.g., "w" for write)
- `p` = permissions (array of abbreviated permission strings)
- `r` = roles (array of role names)
- `b` = buckets (array of bucket names or compressed object)
- `l` = level (authorization level: "read", "write", "admin")

For compatibility with agents that prefer explicit data, each shortened field now has a fully expanded companion value:

- `scope` mirrors `s`
- `permissions` contains the canonical AWS actions that correspond to `p`
- `roles` mirrors `r`
- `buckets` is the authoritative list of bucket names derived from `b`
- `level` mirrors `l`

Backends should prefer the expanded fields when present and only fall back to the abbreviated values if the explicit arrays are missing.

## Permission Abbreviations

Permissions are abbreviated to save space:

| Full Permission           | Abbreviation |
| ------------------------- | ------------ |
| `s3:GetObject`            | `g`          |
| `s3:PutObject`            | `p`          |
| `s3:DeleteObject`         | `d`          |
| `s3:ListBucket`           | `l`          |
| `s3:ListAllMyBuckets`     | `la`         |
| `s3:GetObjectVersion`     | `gv`         |
| `s3:PutObjectAcl`         | `pa`         |
| `s3:AbortMultipartUpload` | `amu`        |

## Bucket Compression

When there are more than 15 buckets, the system applies compression to the `b` claim while always emitting the explicit `buckets` array:

### Format 1: Groups

```json
{
  "_type": "groups",
  "_data": {
    "quilt": ["sandbox-bucket", "sales-raw", "demos"],
    "cell": ["cellpainting-gallery", "cellxgene-913524946226-us-east-1"],
    "other": ["data-drop-off-bucket", "example-pharma-data"]
  }
}
```

### Format 2: Patterns

```json
{
  "_type": "patterns",
  "_data": {
    "quilt": ["sandbox-bucket", "sales-raw", "demos"],
    "cell": ["cellpainting-gallery", "cellxgene-913524946226-us-east-1"],
    "other": ["data-drop-off-bucket", "example-pharma-data"]
  }
}
```

### Format 3: Compressed

```json
{
  "_type": "compressed",
  "_data": "eyJxdWlsdC1zYW5kYm94LWJ1Y2tldCI..."
}
```

## MCP Server Implementation

The MCP server should:

1. Prefer the explicit `permissions`, `buckets`, `roles`, `scope`, and `level` fields when present.
2. Fall back to the abbreviated claims (`p`, `b`, `r`, `s`, `l`) and apply decompression/expansion only when the explicit fields are absent.
3. Validate that the `buckets` array contains the expected number of entries (32 for production roles) before authorizing a request.

## Example JWT Payload

```json
{
  "iss": "quilt-frontend",
  "aud": "quilt-mcp-server",
  "sub": "user-id",
  "iat": 1758740633,
  "exp": 1758827033,
  "jti": "1a2b3c4d5e",
  "s": "w",
  "p": ["g", "p", "d", "l", "la"],
  "r": ["ReadWriteQuiltV2-sales-prod"],
  "b": {
    "_type": "groups",
    "_data": {
      "quilt": ["sandbox-bucket", "sales-raw", "demos"],
      "cell": ["cellpainting-gallery"],
      "other": ["data-drop-off-bucket"]
    }
  },
  "l": "write",
  "scope": "w",
  "permissions": [
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject",
    "s3:ListBucket",
    "s3:ListAllMyBuckets"
  ],
  "roles": ["ReadWriteQuiltV2-sales-prod"],
  "buckets": ["quilt-sandbox-bucket", "quilt-sales-raw", "quilt-demos"],
  "level": "write"
}
```
