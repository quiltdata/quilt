<!-- markdownlint-disable line-length -->
# Authentication Guide

## Overview

Quilt supports two authentication methods for accessing your data:

- **Interactive Login**: Web-based OAuth/SSO authentication (best for notebooks, local development)
- **API Keys**: Token-based authentication (best for automation, CI/CD, scripts)

## Interactive Authentication

Interactive authentication uses OAuth or SSO to authenticate through your web browser. This is the recommended method for personal use, Jupyter notebooks, and local development.

### Login

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

```python
# Returns catalog URL if authenticated, None otherwise
catalog_url = quilt3.logged_in()

if catalog_url:
    print(f"Authenticated to: {catalog_url}")
else:
    print("Not authenticated")
```

### Logout

```python
# Clear all credentials (both interactive and API keys)
quilt3.logout()
```

## API Key Authentication

API keys provide programmatic access to Quilt without requiring browser-based authentication. Keys are created through the Python API and can be used for automated workflows.

### When to Use API Keys

**✅ Use API keys for:**

- CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins)
- Server-side applications and microservices
- Docker containers and Kubernetes pods
- AWS Lambda functions and cloud services
- Scheduled jobs and cron tasks
- Automated data pipelines

**❌ Don't use API keys for:**

- Personal laptops and workstations (use interactive login)
- Shared development environments
- Jupyter notebooks on your local machine
- Any situation where browser-based login works

### Creating Your First API Key

#### Step 1: Authenticate Interactively

First, log in using the interactive method:

```python
import quilt3
quilt3.login()
```

#### Step 2: Create an API Key

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

Choose one of these secure storage methods:

**Environment Variable** (recommended for local development):

```bash
export QUILT_API_KEY="qk_your_secret_here"
```

**AWS Secrets Manager** (recommended for production):

```bash
aws secretsmanager create-secret \
    --name quilt-api-key \
    --secret-string "qk_your_secret_here"
```

**GitHub Secrets** (for GitHub Actions):

1. Go to your repository Settings → Secrets → Actions
2. Add a new secret named `QUILT_API_KEY`
3. Paste your API key as the value

**Other options**:

- Azure Key Vault
- Google Secret Manager
- HashiCorp Vault
- 1Password, LastPass (for personal use)

#### Step 4: Use the API Key

```python
import os
import quilt3

# Load from environment
api_key = os.environ["QUILT_API_KEY"]
quilt3.login_with_api_key(api_key)

# Now use Quilt normally
pkg = quilt3.Package.browse("mypackage", "s3://mybucket")
```

### Managing Your API Keys

#### List All Your Keys

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

## Common Use Cases

### CI/CD Pipelines

#### GitHub Actions

**.github/workflows/data-pipeline.yml**:

```yaml
name: Data Pipeline
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install quilt3

      - name: Sync data
        run: python sync_data.py
        env:
          QUILT_API_KEY: ${{ secrets.QUILT_API_KEY }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

**sync_data.py**:

```python
import os
import quilt3

# Authenticate with API key
api_key = os.environ.get("QUILT_API_KEY")
if not api_key:
    raise ValueError("QUILT_API_KEY environment variable not set")

quilt3.login_with_api_key(api_key)

# Use Quilt
pkg = quilt3.Package.browse("data/latest", "s3://mybucket")
print(f"Package has {len(pkg)} files")

# Process data...
```

#### GitLab CI

**.gitlab-ci.yml**:

```yaml
stages:
  - sync

sync_data:
  stage: sync
  image: python:3.11
  script:
    - pip install quilt3
    - python sync_data.py
  variables:
    QUILT_API_KEY: $QUILT_API_KEY
  rules:
    - if: '$CI_PIPELINE_SOURCE == "schedule"'
    - if: '$CI_COMMIT_BRANCH == "main"'
```

### Docker Containers

**Dockerfile**:

```dockerfile
FROM python:3.11-slim

# Install Quilt
RUN pip install quilt3

# Copy application
COPY app.py /app/app.py
WORKDIR /app

# API key passed at runtime
ENV QUILT_API_KEY=""

CMD ["python", "app.py"]
```

**docker-compose.yml**:

```yaml
version: '3.8'
services:
  data-processor:
    build: .
    environment:
      - QUILT_API_KEY=${QUILT_API_KEY}
    env_file:
      - .env  # Contains QUILT_API_KEY=qk_...
```

**app.py**:

```python
import os
import quilt3

def main():
    # Authenticate
    api_key = os.environ.get("QUILT_API_KEY")
    if not api_key:
        raise ValueError("QUILT_API_KEY not set")

    quilt3.login_with_api_key(api_key)

    # Use Quilt
    pkg = quilt3.Package.browse("data/latest", "s3://mybucket")
    # Process data...

if __name__ == "__main__":
    main()
```

Run with:

```bash
docker run -e QUILT_API_KEY="qk_..." data-processor
```

### AWS Lambda

**lambda_function.py**:

```python
import os
import quilt3

# Initialize outside handler for connection reuse
def get_authenticated_session():
    """Authenticate once per Lambda container lifecycle"""
    if not quilt3.logged_in():
        api_key = os.environ["QUILT_API_KEY"]
        quilt3.login_with_api_key(api_key)

def lambda_handler(event, context):
    # Ensure authenticated
    get_authenticated_session()

    # Use Quilt
    pkg = quilt3.Package.browse("data/latest", "s3://mybucket")

    # Process data
    result = process_package(pkg)

    return {
        "statusCode": 200,
        "body": result
    }

def process_package(pkg):
    # Your processing logic
    return {"files": len(pkg)}
```

**Deploy with AWS SAM** (template.yaml):

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  DataProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: lambda_function.lambda_handler
      Runtime: python3.11
      Environment:
        Variables:
          QUILT_API_KEY: '{{resolve:secretsmanager:quilt-api-key:SecretString}}'
      Policies:
        - S3ReadPolicy:
            BucketName: mybucket
```

### Kubernetes Deployments

**Create secret**:

```bash
kubectl create secret generic quilt-credentials \
  --from-literal=api-key="qk_your_secret_here"
```

**deployment.yaml**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: data-processor
spec:
  replicas: 3
  selector:
    matchLabels:
      app: data-processor
  template:
    metadata:
      labels:
        app: data-processor
    spec:
      containers:
      - name: processor
        image: myregistry/data-processor:latest
        env:
        - name: QUILT_API_KEY
          valueFrom:
            secretKeyRef:
              name: quilt-credentials
              key: api-key
```

### Cron Jobs

**crontab**:

```bash
# Daily data sync at 2 AM
0 2 * * * /usr/bin/python3 /home/user/sync_data.py >> /var/log/quilt-sync.log 2>&1
```

**/home/user/sync_data.py**:

```python
#!/usr/bin/env python3
import os
import sys
import logging
import quilt3

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def main():
    try:
        # Load API key from environment
        api_key = os.environ.get("QUILT_API_KEY")
        if not api_key:
            # Try loading from .env file
            env_file = os.path.expanduser("~/.quilt/api_key")
            with open(env_file) as f:
                api_key = f.read().strip()

        logging.info("Authenticating to Quilt...")
        quilt3.login_with_api_key(api_key)

        logging.info("Fetching package...")
        pkg = quilt3.Package.browse("data/latest", "s3://mybucket")

        logging.info(f"Processing {len(pkg)} files...")
        # Your processing logic here

        logging.info("Sync completed successfully")
        return 0

    except Exception as e:
        logging.error(f"Sync failed: {e}", exc_info=True)
        return 1

if __name__ == "__main__":
    sys.exit(main())
```

Make executable:

```bash
chmod +x /home/user/sync_data.py
```

## Administrator Guide

Administrators have additional capabilities to manage API keys across all users.

### Prerequisites

You must be an admin user to access these functions:

```python
import quilt3.admin
```

### List All API Keys

```python
import quilt3.admin

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

```python
# Get details about a specific key
key = quilt3.admin.api_keys.get("key-id-here")

if key:
    print(f"Key: {key.name}")
    print(f"Owner: {key.created_by_email}")
    print(f"Status: {key.status}")
    print(f"Created: {key.created_at}")
    print(f"Expires: {key.expires_at}")
    print(f"Last used: {key.last_used_at or 'Never'}")
```

### Revoke a User's Key

```python
# Revoke a specific key by ID
key_id = "key-id-here"
quilt3.admin.api_keys.revoke(id=key_id)
print(f"Revoked key: {key_id}")
```

### Audit Key Usage

```python
import quilt3.admin
from datetime import datetime, timedelta

# Find keys that haven't been used in 90 days
threshold = datetime.now() - timedelta(days=90)
all_keys = quilt3.admin.api_keys.list(status="ACTIVE")

unused_keys = []
for key in all_keys:
    if key.last_used_at is None or key.last_used_at < threshold:
        unused_keys.append(key)
        print(f"⚠️  Unused key: {key.name} (owner: {key.created_by_email})")
        print(f"   Last used: {key.last_used_at or 'Never'}")

print(f"\nFound {len(unused_keys)} unused keys")
```

### Generate Usage Reports

```python
import quilt3.admin
from collections import defaultdict

# Keys by user
keys_by_user = defaultdict(list)
all_keys = quilt3.admin.api_keys.list()

for key in all_keys:
    keys_by_user[key.created_by_email].append(key)

# Report
print("API Key Usage Report")
print("=" * 60)
for email, keys in sorted(keys_by_user.items()):
    active = sum(1 for k in keys if k.status == "ACTIVE")
    expired = sum(1 for k in keys if k.status == "EXPIRED")
    print(f"{email}:")
    print(f"  Active: {active}, Expired: {expired}, Total: {len(keys)}")
```

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

   ```python
   api_key = "qk_..."  # Must start with qk_
   if not api_key.startswith("qk_"):
       print("Invalid key format!")
   ```

2. **Check if key is expired**:

   ```python
   import quilt3
   quilt3.login()  # Use interactive login first

   keys = quilt3.api_keys.list()
   for key in keys:
       print(f"{key.name}: {key.status}")
   ```

3. **Clear old sessions**:

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

### Docker Environment Variables

**Issue**: Key not available in container

**Solution**: Verify the variable is passed:

```bash
# Test that variable is available
docker run -e QUILT_API_KEY="$QUILT_API_KEY" myimage \
  python -c "import os; print('Key set:', bool(os.environ.get('QUILT_API_KEY')))"
```

### Lambda Function Errors

**Issue**: Lambda can't find API key

**Solutions**:

1. **Verify environment variable**:
   - AWS Console → Lambda → Configuration → Environment variables
   - Should see `QUILT_API_KEY` in the list

2. **Use Secrets Manager**:

   ```python
   import boto3
   import json

   def get_secret():
       client = boto3.client('secretsmanager')
       response = client.get_secret_value(SecretId='quilt-api-key')
       return response['SecretString']

   api_key = get_secret()
   quilt3.login_with_api_key(api_key)
   ```

## Migration from Interactive to API Key

If you have existing scripts using `quilt3.login()`, here's how to migrate:

### Before (Interactive Login)

```python
import quilt3

# Requires browser - doesn't work in CI/CD
quilt3.login()

pkg = quilt3.Package.browse("data/latest", "s3://mybucket")
```

### After (API Key)

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
