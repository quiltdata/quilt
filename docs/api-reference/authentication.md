<!-- markdownlint-disable line-length -->
# Authentication Guide

## Overview

Quilt supports two authentication methods for accessing your data:

- **Interactive Login**: Web-based OAuth/SSO authentication (best for notebooks, local development)
- **API Keys**: Token-based authentication (best for automation, CI/CD, scripts)

## Interactive Authentication

Interactive authentication uses OAuth or SSO to authenticate through your web browser. This is the recommended method for personal use, Jupyter notebooks, and local development.

### Login

<!-- pytest-codeblocks:skip -->
```python
import quilt3

# Opens your browser for authentication
quilt3.login()
```

This command will:

1. Open your default web browser
2. Redirect you to your Quilt catalog's login page
3. After successful authentication, save credentials locally
4. Return you to your Python session

### Check Authentication Status

<!-- pytest-codeblocks:skip -->
```python
# Returns catalog URL if authenticated, None otherwise
catalog_url = quilt3.logged_in()

if catalog_url:
    print(f"Authenticated to: {catalog_url}")
else:
    print("Not authenticated")
```

### Logout

<!-- pytest-codeblocks:skip -->
```python
# Clear all credentials (both interactive and API keys)
quilt3.logout()
```

## API Key Authentication

API keys provide programmatic access to Quilt without requiring browser-based authentication. Keys are created through the Python API and can be used for automated workflows.

### When to Use API Keys

**✅ Use API keys for:**

- Automated scripts and data pipelines
- Server-side applications and microservices
- Containerized applications (Docker, Kubernetes)
- Cloud functions and serverless workloads
- CI/CD pipelines and automated workflows
- Scheduled jobs and batch processing

### Creating Your First API Key

#### Step 1: Authenticate Interactively

First, log in using the interactive method:

<!-- pytest-codeblocks:skip -->
```python
import quilt3
quilt3.login()
```

#### Step 2: Create an API Key

<!-- pytest-codeblocks:skip -->
```python
# Create a key that expires in 90 days (default)
key, secret = quilt3.api_keys.create("my-automation-key")

# Or specify a custom expiration (1-365 days)
key, secret = quilt3.api_keys.create("my-key", expires_in_days=180)

# IMPORTANT: Save the secret - it's only shown once!
print(f"Key ID: {key.id}")
print(f"Secret: {secret}")
print(f"Fingerprint: {key.fingerprint}")
print(f"Expires: {key.expires_at}")

# Example output:
# Secret: qk_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z...
```

**⚠️ Security Warning**: The secret is only shown once during creation. Save it immediately in a secure location. If you lose it, you'll need to create a new key.

#### Step 3: Store the Secret Securely

Choose a secure storage method based on your environment:

**Local Development** (.env file):

Create a `.env` file in your project directory:

```bash
# .env
QUILT_API_KEY=qk_your_secret_here
```

Load it in your Python code:

<!-- pytest-codeblocks:skip -->
```python
from dotenv import load_dotenv
import os

load_dotenv()  # Load .env file
api_key = os.environ["QUILT_API_KEY"]
```

**IMPORTANT**: Add `.env` to your `.gitignore` to prevent committing secrets.

For production deployments, embed it in environment variables or AWS secrets manager.

#### Step 4: Use the API Key

<!-- pytest-codeblocks:skip -->
```python
import os
import quilt3

# Load from environment
api_key = os.environ["QUILT_API_KEY"]
quilt3.login_with_api_key(api_key)

# Now use Quilt normally
pkg = quilt3.Package.browse("mypackage", "s3://mybucket")
```

NOTE: quilt3 will **not** automatically detect and use the QUILT_API_KEY.
You must explicitly login with it.

### Managing Your API Keys

#### List All Your Keys

<!-- pytest-codeblocks:skip -->
```python
import quilt3

# List all your keys
keys = quilt3.api_keys.list()
for key in keys:
    print(f"\n{key.name}")
    print(f"  ID: {key.id}")
    print(f"  Fingerprint: {key.fingerprint}")
    print(f"  Status: {key.status}")
    print(f"  Created: {key.created_at}")
    print(f"  Expires: {key.expires_at}")
    print(f"  Last used: {key.last_used_at or 'Never'}")
```

#### Filter Keys

<!-- pytest-codeblocks:skip -->
```python
# Find keys by name
production_keys = quilt3.api_keys.list(name="production-pipeline")

# Find keys by fingerprint
key = quilt3.api_keys.list(fingerprint="qk_abc...xyz")

# Find only active keys
active_keys = quilt3.api_keys.list(status="ACTIVE")

# Find expired keys
expired_keys = quilt3.api_keys.list(status="EXPIRED")
```

#### Get a Specific Key

<!-- pytest-codeblocks:skip -->
```python
# Get details about a specific key
key = quilt3.api_keys.get("key-id-here")

if key:
    print(f"Status: {key.status}")
    if key.status == "EXPIRED":
        print("This key has expired and needs to be rotated")
else:
    print("Key not found")
```

#### Revoke a Key

<!-- pytest-codeblocks:skip -->
```python
# Revoke by ID (if you know it)
quilt3.api_keys.revoke(id="key-id-here")

# Or revoke by secret (useful for immediate emergency revocation)
quilt3.api_keys.revoke(secret="qk_your_secret")
```

## Best Practices

### Security Guidelines

- 🔐 **Never commit API keys to version control**
  - Add `.env` files to `.gitignore`
  - Use secret scanning tools (GitGuardian, GitHub Advanced Security)

- 🔐 **Use environment variables or secret managers**
  - Never hardcode keys in source code
  - Prefer managed secret services in production

- 🔐 **Rotate keys regularly**
  - Set up rotation before expiration (60-90 days)
  - Plan rotation during low-traffic periods

- 🔐 **Use descriptive names**
  - Include purpose, environment, and date: `ci-github-prod-2026q1`
  - Makes key management and auditing easier

- 🔐 **Revoke unused keys immediately**
  - Delete keys when pipelines are retired
  - Conduct regular key audits

- 🔐 **Use separate keys per environment**
  - Different keys for dev, staging, production
  - Limits blast radius if a key is compromised

## Administrator Guide

Administrators have additional capabilities to manage API keys across all users.

### Prerequisites

You must be an admin user to access these functions:

```python
import quilt3.admin
```

### List All API Keys

<!-- pytest-codeblocks:skip -->
```python
# List all keys in the system
all_keys = quilt3.admin.api_keys.list()
print(f"Total keys: {len(all_keys)}")

# Filter by user email
user_keys = quilt3.admin.api_keys.list(email="user@example.com")
print(f"Keys for user@example.com: {len(user_keys)}")

# Filter by key name
pipeline_keys = quilt3.admin.api_keys.list(key_name="ci-pipeline")

# Filter by status
active_keys = quilt3.admin.api_keys.list(status="ACTIVE")
expired_keys = quilt3.admin.api_keys.list(status="EXPIRED")

print(f"Active keys: {len(active_keys)}")
print(f"Expired keys: {len(expired_keys)}")
```

### Get Key Details

<!-- pytest-codeblocks:skip -->
```python
# Get details about a specific key
key = quilt3.admin.api_keys.get("key-id-here")

if key:
    print(f"Key: {key.name}")
    print(f"Owner: {key.user_email}")
    print(f"ID: {key.id}")
    print(f"Status: {key.status}")
    print(f"Created: {key.created_at}")
    print(f"Expires: {key.expires_at}")
    print(f"Last used: {key.last_used_at or 'Never'}")

### Revoke a User's Key

<!-- pytest-codeblocks:skip -->
```python
# Revoke a specific key by ID
key_id = "key-id-here"
quilt3.admin.api_keys.revoke(id=key_id)
print(f"Revoked key: {key_id}")
```

### Audit Key Usage

<!-- pytest-codeblocks:skip -->
```python
from datetime import datetime, timedelta

# Find keys that haven't been used in 90 days
threshold = datetime.now() - timedelta(days=90)
all_keys = quilt3.admin.api_keys.list(status="ACTIVE")

unused_keys = []
for key in all_keys:
    if key.last_used_at is None or key.last_used_at < threshold:
        unused_keys.append(key)
        print(f"⚠️  Unused key: {key.name}")
        print(f"   Owner: {key.user_email}")
        print(f"   ID: {key.id}")
        print(f"   Last used: {key.last_used_at or 'Never'}")

print(f"\nFound {len(unused_keys)} unused keys")
```

### Generate Usage Reports

<!-- pytest-codeblocks:skip -->
```python
# Get summary statistics
all_keys = quilt3.admin.api_keys.list()

active = sum(1 for k in all_keys if k.status == "ACTIVE")
expired = sum(1 for k in all_keys if k.status == "EXPIRED")

print("API Key Usage Report")
print("=" * 60)
print(f"Total keys: {len(all_keys)}")
print(f"Active: {active}")
print(f"Expired: {expired}")

# Show recent keys
print("\nRecently created keys:")
sorted_keys = sorted(all_keys, key=lambda k: k.created_at, reverse=True)
for key in sorted_keys[:10]:
    print(f"  {key.name}")
    print(f"    Created: {key.created_at}")
    print(f"    Status: {key.status}")
    print(f"    Owner: {key.user_email}")

### Athena Query for Audit Trail

For detailed audit trail queries, see the [GxP documentation](../advanced-features/good-practice.md#api-key-audit-events).

Example query to find all API key usage in the last 30 days:

```sql
SELECT
    eventtime,
    eventname,
    json_extract_scalar(useridentity, '$.email') as user_email,
    json_extract_scalar(useridentity, '$.sessionContext.auth.keyName') as key_name,
    json_extract_scalar(useridentity, '$.sessionContext.auth.keyFingerprint') as key_fingerprint,
    sourceipaddress
FROM audit_trail
WHERE date >= date_format(current_date - interval '30' day, '%Y/%m/%d')
    AND json_extract_scalar(useridentity, '$.sessionContext.auth.type') = 'api_key'
ORDER BY eventtime DESC
LIMIT 100;
```

## Troubleshooting

### Authentication Failed

**Error**: `Authentication failed. Check your credentials or API key.`

**Solutions**:

1. **Verify the key format**:

   <!-- pytest-codeblocks:skip -->
   ```python
   api_key = "qk_..."  # Must start with qk_
   if not api_key.startswith("qk_"):
       print("Invalid key format!")
   ```

2. **Check if key is expired**:

   <!-- pytest-codeblocks:skip -->
   ```python
   import quilt3
   quilt3.login()  # Use interactive login first

   keys = quilt3.api_keys.list()
   for key in keys:
       print(f"{key.name}: {key.status}")
   ```

3. **Clear old sessions**:

   <!-- pytest-codeblocks:skip -->
   ```python
   import quilt3
   quilt3.logout()  # Clear all credentials
   quilt3.login_with_api_key(api_key)  # Try again
   ```

### API Key Prefix Error

**Error**: `API key must start with 'qk_' prefix`

**Solutions**:

- Verify you copied the complete secret
- Check for whitespace: `api_key = api_key.strip()`
- Regenerate the key if needed

### Key Expired

**Error**: Key shows `status: EXPIRED`

**Solution**: Create a new key:

<!-- pytest-codeblocks:skip -->
```python
import quilt3

# Check expiration
quilt3.login()
keys = quilt3.api_keys.list(name="my-key")
for key in keys:
    print(f"Status: {key.status}")
    print(f"Expires: {key.expires_at}")

# Create new key
new_key, secret = quilt3.api_keys.create("my-key-v2", expires_in_days=90)
print(f"New secret: {secret}")

# Revoke old key
quilt3.api_keys.revoke(id=keys[0].id)
```

### Environment Variable Not Set

**Error**: `QUILT_API_KEY environment variable not set`

**Solutions**:

1. **Check if variable is set**:

   ```python
   import os
   print(os.environ.get("QUILT_API_KEY"))  # Should show qk_...
   ```

2. **Set in current session**:

   ```bash
   export QUILT_API_KEY="qk_your_secret"
   ```

3. **Add to shell profile** (~/.bashrc, ~/.zshrc):

   ```bash
   echo 'export QUILT_API_KEY="qk_..."' >> ~/.bashrc
   source ~/.bashrc
   ```

4. **Use .env file** (recommended):

   ```bash
   echo 'QUILT_API_KEY="qk_..."' >> .env
   ```

   Then load it in Python:

   <!-- pytest-codeblocks:skip -->
   ```python
   from dotenv import load_dotenv
   load_dotenv()
   ```

## Migration from Interactive to API Key

If you have existing scripts using `quilt3.login()`, here's how to migrate:

### Before (Interactive Login)

<!-- pytest-codeblocks:skip -->
```python
import quilt3

# Requires browser - doesn't work in CI/CD
quilt3.login()

pkg = quilt3.Package.browse("data/latest", "s3://mybucket")
```

### After (API Key)

<!-- pytest-codeblocks:skip -->
```python
import os
import quilt3

# One-time setup: Create API key
# (Run this once on your local machine)
# quilt3.login()
# key, secret = quilt3.api_keys.create("my-script")
# print(f"Secret: {secret}")

# In your script: Use the API key
api_key = os.environ.get("QUILT_API_KEY")
if not api_key:
    raise ValueError("QUILT_API_KEY environment variable required")

quilt3.login_with_api_key(api_key)

pkg = quilt3.Package.browse("data/latest", "s3://mybucket")
```

### Migration Checklist

- [ ] Create API key using interactive login
- [ ] Save secret to secure location
- [ ] Add environment variable to deployment
- [ ] Update code to use `login_with_api_key()`
- [ ] Test in development environment
- [ ] Deploy to production
- [ ] Verify API key works
- [ ] Document key location for team

## API Reference

For detailed API documentation, see:

- [quilt3.api_keys](api.md#api-keys) - User API
- [quilt3.admin.api_keys](Admin.md#api-keys) - Admin API
- [Audit Trail Events](../advanced-features/good-practice.md#api-key-audit-events) - Security & Compliance

## Additional Resources

- [Installation Guide](../Installation.md)
- [Quick Start](../Quickstart.md)
- [GxP & Security Best Practices](../advanced-features/good-practice.md)
- [Troubleshooting](../Troubleshooting.md)
