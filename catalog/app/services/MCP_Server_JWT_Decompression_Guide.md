# MCP Server JWT Decompression Guide

This guide explains how the MCP server should decompress the enhanced JWT tokens from the frontend to restore full permission and bucket data, and how to leverage the expanded fields that accompany the compressed claims.

## Overview

The frontend sends compressed JWT tokens with:
- **Abbreviated permissions** (e.g., `"g"` instead of `"s3:GetObject"`)
- **Compressed bucket data** (grouped, patterned, or base64 encoded)
- **Shortened field names** (e.g., `"p"` instead of `"permissions"`)

## JWT Payload Structure

```json
{
  "iss": "quilt-frontend",
  "aud": "quilt-mcp-server",
  "sub": "user-id",
  "iat": 1758740633,
  "exp": 1758827033,
  "jti": "1a2b3c4d5e",
  "s": "w",                    // scope (abbreviated key)
  "p": ["g", "p", "d", "l"],  // permissions (abbreviated)
  "r": ["ReadWriteQuiltV2-sales-prod"], // roles (abbreviated key)
  "b": {                      // buckets (compressed)
    "_type": "groups",
    "_data": {
      "quilt": ["sandbox-bucket", "sales-raw"],
      "cell": ["cellpainting-gallery"]
    }
  },
  "l": "write",                // level (abbreviated key)
  "scope": "w",                // mirrors `s`
  "permissions": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
  "roles": ["ReadWriteQuiltV2-sales-prod"],
  "buckets": ["quilt-sandbox-bucket", "quilt-sales-raw"],
  "level": "write"
}
```

## Decompression Implementation

### 1. Permission Decompression

```python
# Python example
PERMISSION_ABBREVIATIONS = {
    'g': 's3:GetObject',
    'p': 's3:PutObject',
    'd': 's3:DeleteObject',
    'l': 's3:ListBucket',
    'la': 's3:ListAllMyBuckets',
    'gv': 's3:GetObjectVersion',
    'pa': 's3:PutObjectAcl',
    'amu': 's3:AbortMultipartUpload'
}

def decompress_permissions(abbreviated_permissions):
    """Convert abbreviated permissions back to full AWS permission strings."""
    full_permissions = []
    for abbrev in abbreviated_permissions:
        if abbrev in PERMISSION_ABBREVIATIONS:
            full_permissions.append(PERMISSION_ABBREVIATIONS[abbrev])
        else:
            # Fallback for unknown abbreviations
            full_permissions.append(abbrev)
    return full_permissions

# Usage
abbreviated = ["g", "p", "d", "l", "la"]
full_permissions = decompress_permissions(abbreviated)
# Result: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:ListAllMyBuckets"]
```

### 2. Bucket Decompression

```python
import base64
import json

def decompress_buckets(bucket_data):
    """Decompress bucket data based on compression type."""
    if isinstance(bucket_data, list):
        # No compression applied
        return bucket_data
    
    if not isinstance(bucket_data, dict) or '_type' not in bucket_data:
        # Fallback for unexpected format
        return bucket_data
    
    compression_type = bucket_data['_type']
    data = bucket_data['_data']
    
    if compression_type == 'groups':
        return decompress_groups(data)
    elif compression_type == 'patterns':
        return decompress_patterns(data)
    elif compression_type == 'compressed':
        return decompress_compressed(data)
    else:
        # Unknown compression type, return as-is
        return bucket_data

def decompress_groups(grouped_data):
    """Decompress grouped bucket data."""
    buckets = []
    for prefix, bucket_suffixes in grouped_data.items():
        for suffix in bucket_suffixes:
            if prefix == 'quilt':
                buckets.append(f"quilt-{suffix}")
            else:
                buckets.append(f"{prefix}-{suffix}")
    return buckets

def decompress_patterns(pattern_data):
    """Decompress pattern-based bucket data."""
    buckets = []
    for pattern, bucket_list in pattern_data.items():
        if pattern == 'quilt':
            # Add 'quilt-' prefix to each bucket
            for bucket in bucket_list:
                buckets.append(f"quilt-{bucket}")
        elif pattern == 'cell':
            # Keep cell buckets as-is
            buckets.extend(bucket_list)
        else:
            # Other patterns - keep as-is
            buckets.extend(bucket_list)
    return buckets

def decompress_compressed(compressed_data):
    """Decompress base64 encoded bucket data."""
    try:
        decoded = base64.b64decode(compressed_data).decode('utf-8')
        return json.loads(decoded)
    except Exception as e:
        # Fallback if decompression fails
        print(f"Failed to decompress bucket data: {e}")
        return []

# Usage examples
bucket_data = {
    "_type": "groups",
    "_data": {
        "quilt": ["sandbox-bucket", "sales-raw"],
        "cell": ["cellpainting-gallery"]
    }
}
buckets = decompress_buckets(bucket_data)
# Result: ["quilt-sandbox-bucket", "quilt-sales-raw", "cell-cellpainting-gallery"]
```

### 3. Complete JWT Processing

```python
def process_compressed_jwt(jwt_payload):
    """Process a compressed JWT payload and return standard format."""
    if not isinstance(jwt_payload, dict):
        return {
            'scope': 'read',
            'permissions': [],
            'roles': [],
            'buckets': [],
            'level': 'read'
        }

    # Prefer expanded fields when available
    scope = jwt_payload.get('scope') or jwt_payload.get('s', '')

    explicit_permissions = jwt_payload.get('permissions')
    compressed_permissions = jwt_payload.get('p', [])
    permissions = explicit_permissions or decompress_permissions(compressed_permissions)

    explicit_roles = jwt_payload.get('roles')
    compressed_roles = jwt_payload.get('r', [])
    roles = explicit_roles or compressed_roles

    explicit_buckets = jwt_payload.get('buckets')
    compressed_buckets = jwt_payload.get('b', [])
    buckets = explicit_buckets or decompress_buckets(compressed_buckets)

    level = jwt_payload.get('level') or jwt_payload.get('l', 'read')

    return {
        'scope': scope,
        'permissions': permissions,
        'roles': roles,
        'buckets': buckets,
        'level': level,
        'iss': jwt_payload.get('iss'),
        'aud': jwt_payload.get('aud'),
        'sub': jwt_payload.get('sub'),
        'iat': jwt_payload.get('iat'),
        'exp': jwt_payload.get('exp'),
        'jti': jwt_payload.get('jti')
    }

# Usage
compressed_payload = {
    "s": "w",
    "p": ["g", "p", "d", "l"],
    "r": ["ReadWriteQuiltV2-sales-prod"],
    "b": {
        "_type": "groups",
        "_data": {
            "quilt": ["sandbox-bucket", "sales-raw"]
        }
    },
    "l": "write",
    "permissions": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
    "buckets": ["quilt-sandbox-bucket", "quilt-sales-raw"],
    "scope": "w",
    "level": "write"
}

standard_payload = process_compressed_jwt(compressed_payload)
# Result: Standard JWT payload with full permission strings and bucket names
```

## Field Mapping Reference

| Compressed Field | Standard Field | Description |
|------------------|----------------|-------------|
| `s` | `scope` | Authorization scope |
| `p` | `permissions` | AWS permission strings |
| `r` | `roles` | User roles |
| `b` | `buckets` | Accessible bucket names |
| `l` | `level` | Authorization level |
| `scope`/`permissions`/`roles`/`buckets`/`level` | (explicit mirrors) | Prefer these when present |

## Error Handling

```python
def safe_decompress_jwt(jwt_payload):
    """Safely decompress JWT with fallbacks for errors."""
    try:
        return process_compressed_jwt(jwt_payload)
    except Exception as e:
        print(f"JWT decompression failed: {e}")
        # Return minimal valid payload
        if not isinstance(jwt_payload, dict):
            return {
                'scope': 'read',
                'permissions': ['s3:GetObject'],
                'roles': [],
                'buckets': [],
                'level': 'read'
            }

        return {
            'scope': jwt_payload.get('scope') or jwt_payload.get('s', 'read'),
            'permissions': jwt_payload.get('permissions') or ['s3:GetObject'],
            'roles': jwt_payload.get('roles') or jwt_payload.get('r', []),
            'buckets': jwt_payload.get('buckets') or [],
            'level': jwt_payload.get('level') or jwt_payload.get('l', 'read')
        }
```

## Validation Checklist

Before authorizing a request, make sure that:

- `buckets` exists and contains the expected number of entries (32 for production write roles).
- `permissions` is non-empty and includes the required S3 actions for the requested tool.
- `scope`/`level` match the requested capability and the token has not expired.
- Validation failures are logged to aid troubleshooting.

## Testing

```python
# Test cases for decompression
test_cases = [
    {
        "name": "Groups compression",
        "input": {
            "_type": "groups",
            "_data": {
                "quilt": ["sandbox-bucket", "sales-raw"],
                "cell": ["cellpainting-gallery"]
            }
        },
        "expected": ["quilt-sandbox-bucket", "quilt-sales-raw", "cell-cellpainting-gallery"]
    },
    {
        "name": "Patterns compression", 
        "input": {
            "_type": "patterns",
            "_data": {
                "quilt": ["sandbox-bucket", "sales-raw"],
                "other": ["data-drop-off-bucket"]
            }
        },
        "expected": ["quilt-sandbox-bucket", "quilt-sales-raw", "data-drop-off-bucket"]
    },
    {
        "name": "No compression",
        "input": ["quilt-sandbox-bucket", "quilt-sales-raw"],
        "expected": ["quilt-sandbox-bucket", "quilt-sales-raw"]
    }
]

for test in test_cases:
    result = decompress_buckets(test["input"])
    assert result == test["expected"], f"Test {test['name']} failed"
    print(f"✅ {test['name']} passed")
```

## Integration Points

1. **JWT Validation**: Decompress before validating permissions
2. **AWS IAM Checks**: Use decompressed permissions for policy validation
3. **Bucket Access**: Use decompressed bucket list for access control
4. **Logging**: Log both compressed and decompressed data for debugging

## Performance Considerations

- **Caching**: Cache decompressed data to avoid repeated processing
- **Lazy Loading**: Only decompress when needed
- **Error Recovery**: Graceful fallbacks for malformed data
- **Memory**: Monitor memory usage with large bucket lists

This decompression ensures the MCP server can process the compressed JWT tokens while maintaining full functionality and security.
