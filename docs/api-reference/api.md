# Quilt3 Core API Reference

The `quilt3` module provides the core functionality for working with Quilt packages, including configuration, authentication, package management, and data access. This is the primary interface for most Quilt operations.

## Overview

The core API is organized around several key concepts:

- **Configuration** - Setting up connections to Quilt catalogs
- **Authentication** - Managing credentials and access
- **Package Management** - Creating, installing, and managing packages
- **Data Access** - Reading and writing data through Quilt
- **Utilities** - Helper functions for common operations

## Quick Start

```python
import quilt3

# Configure connection to a Quilt catalog
quilt3.config('https://your-catalog.com')

# Authenticate (opens browser for login)
quilt3.login()

# List available packages
packages = quilt3.list_packages()

# Install a package
pkg = quilt3.Package.install('username/package-name')

# Browse package contents
print(pkg)
```

---

## Configuration

### config(\*catalog\_url, \*\*config\_values) -> QuiltConfig  {#config}

Set or read the Quilt configuration. This is the primary method for connecting to Quilt catalogs and managing client settings.

**Arguments:**
- `catalog_url`: A (single) URL indicating a location to configure from
- `**config_values`: `key=value` pairs to set in the config

**Returns:** `QuiltConfig` (an ordered Mapping)

**Examples:**

```python
import quilt3

# Get current configuration
current_config = quilt3.config()
print(f"Current catalog: {current_config.get('navigator_url', 'Not set')}")

# Configure for a specific catalog (triggers autoconfiguration)
quilt3.config('https://open.quiltdata.com')

# Set specific configuration values
quilt3.config(
    navigator_url='https://your-catalog.com',
    registry_url='s3://your-bucket',
    default_local_registry='./quilt_packages'
)

# Configure with custom settings
quilt3.config(
    navigator_url='https://enterprise.quiltdata.com',
    telemetry_disabled=True,
    default_install_location='~/data'
)
```

**Configuration Options:**
- `navigator_url`: Quilt catalog web interface URL
- `registry_url`: S3 bucket for package storage
- `default_local_registry`: Local directory for installed packages
- `telemetry_disabled`: Disable usage analytics (boolean)
- `default_install_location`: Default directory for package installations

**Best Practices:**
- Use environment-specific configurations for development, staging, and production
- Store sensitive configuration in environment variables
- Verify configuration with `quilt3.config()` after setting

---

## Authentication

### login(catalog\_url=None) -> None  {#login}

Authenticate with a Quilt catalog. Opens a web browser for interactive authentication.

**Arguments:**
- `catalog_url`: Optional catalog URL to authenticate with

**Examples:**

```python
import quilt3

# Login to currently configured catalog
quilt3.login()

# Login to specific catalog
quilt3.login('https://your-catalog.com')

# Check authentication status
try:
    logged_in_url = quilt3.logged_in()
    if logged_in_url:
        print(f"Authenticated to: {logged_in_url}")
    else:
        print("Not authenticated")
except Exception:
    print("Authentication check failed")
```

### logout() -> None  {#logout}

Log out of the current Quilt catalog by removing stored credentials.

**Example:**

```python
import quilt3

# Logout from current catalog
quilt3.logout()
print("Logged out successfully")

# Verify logout
if not quilt3.logged_in():
    print("Logout confirmed")
```

### logged\_in() -> Optional[str]  {#logged\_in}

Check if currently authenticated to a Quilt catalog.

**Returns:** Catalog URL if authenticated, None otherwise

**Example:**

```python
import quilt3

# Check authentication status
catalog_url = quilt3.logged_in()
if catalog_url:
    print(f"Authenticated to: {catalog_url}")
    
    # Get user information if available
    try:
        session = quilt3.get_boto3_session()
        sts = session.client('sts')
        identity = sts.get_caller_identity()
        print(f"AWS Identity: {identity.get('Arn', 'Unknown')}")
    except Exception as e:
        print(f"Could not get AWS identity: {e}")
else:
    print("Not authenticated - run quilt3.login()")
```

---

## Package Management

### delete\_package(name, registry=None, top\_hash=None) -> None  {#delete\_package}

Delete a package from the registry. Deletes only the manifest entries and not the underlying files.

**Arguments:**
- `name (str)`: Name of the package
- `registry (str)`: The registry the package will be removed from
- `top_hash (str)`: Optional. A package hash to delete, instead of the whole package

**Examples:**

```python
import quilt3

# Delete entire package
quilt3.delete_package('username/old-package')

# Delete specific version by hash
quilt3.delete_package(
    'username/package-name',
    top_hash='abc123def456'
)

# Delete from specific registry
quilt3.delete_package(
    'username/package-name',
    registry='s3://my-bucket'
)
```

**⚠️ Warning:** This operation is irreversible. Consider the following before deletion:
- Verify no other packages depend on this package
- Ensure you have backups if needed
- Consider deactivating rather than deleting for audit trails

### list\_packages(registry=None) -> List[str]  {#list\_packages}

List all packages in a registry.

**Arguments:**
- `registry (str)`: Registry to list packages from. Defaults to configured registry.

**Returns:** List of package names

**Examples:**

```python
import quilt3

# List packages in default registry
packages = quilt3.list_packages()
print(f"Found {len(packages)} packages:")
for pkg in packages[:5]:  # Show first 5
    print(f"  {pkg}")

# List packages in specific registry
enterprise_packages = quilt3.list_packages('s3://enterprise-bucket')

# Filter packages by namespace
user_packages = [pkg for pkg in packages if pkg.startswith('myusername/')]
print(f"My packages: {user_packages}")

# Search for packages by keyword
data_packages = [pkg for pkg in packages if 'data' in pkg.lower()]
print(f"Data-related packages: {data_packages}")
```

### copy\_package(name, dest=None, dest\_registry=None, \*\*kwargs) -> Package  {#copy\_package}

Copy a package to a new location or registry.

**Arguments:**
- `name (str)`: Name of package to copy
- `dest (str)`: Destination package name
- `dest_registry (str)`: Destination registry
- `**kwargs`: Additional arguments passed to Package.install()

**Returns:** Copied Package object

**Examples:**

```python
import quilt3

# Copy package to new name in same registry
copied_pkg = quilt3.copy_package(
    'original/dataset',
    dest='backup/dataset-v1'
)

# Copy package to different registry
copied_pkg = quilt3.copy_package(
    'research/experiment-data',
    dest='archive/experiment-data',
    dest_registry='s3://archive-bucket'
)

# Copy specific version
copied_pkg = quilt3.copy_package(
    'team/model-weights',
    dest='production/model-weights',
    top_hash='abc123def456'
)
```

---

## AWS Integration

### get\_boto3\_session(\*, fallback: bool = True) -> boto3.session.Session  {#get\_boto3\_session}

Return a Boto3 session with Quilt stack credentials and AWS region.

**Arguments:**
- `fallback (bool)`: If True, return normal Boto3 session when no Quilt credentials found

**Returns:** Boto3 Session object

**Examples:**

```python
import quilt3

# Get Quilt-configured session
session = quilt3.get_boto3_session()

# Use session for AWS operations
s3 = session.client('s3')
buckets = s3.list_buckets()
print(f"Available buckets: {[b['Name'] for b in buckets['Buckets']]}")

# Use session for other AWS services
dynamodb = session.client('dynamodb')
tables = dynamodb.list_tables()

# Handle case where Quilt credentials not available
try:
    session = quilt3.get_boto3_session(fallback=False)
    print("Using Quilt credentials")
except Exception:
    print("Quilt credentials not available")
    session = quilt3.get_boto3_session(fallback=True)
    print("Using default AWS credentials")
```

### get\_from\_config(key: str) -> Any  {#get\_from\_config}

Get a value from the Quilt configuration.

**Arguments:**
- `key (str)`: Configuration key to retrieve

**Returns:** Configuration value or None if not found

**Examples:**

```python
import quilt3

# Get specific configuration values
catalog_url = quilt3.get_from_config('navigator_url')
registry = quilt3.get_from_config('registry_url')
local_registry = quilt3.get_from_config('default_local_registry')

print(f"Catalog: {catalog_url}")
print(f"Registry: {registry}")
print(f"Local registry: {local_registry}")

# Check if telemetry is disabled
telemetry_disabled = quilt3.get_from_config('telemetry_disabled')
if telemetry_disabled:
    print("Telemetry is disabled")

# Get all configuration as dict
config = quilt3.config()
for key, value in config.items():
    print(f"{key}: {value}")
```

---

## Search and Discovery

### search(query, limit=10) -> List[dict]  {#search}

Search for packages across the configured registry.

**Arguments:**
- `query (str)`: Search query string
- `limit (int)`: Maximum number of results to return

**Returns:** List of search result dictionaries

**Examples:**

```python
import quilt3

# Basic text search
results = quilt3.search("machine learning", limit=20)
for result in results:
    print(f"Package: {result['key']}")
    print(f"Score: {result['score']}")
    print(f"Preview: {result.get('preview', 'No preview')}")

# Search with filters
results = quilt3.search("data AND type:csv")

# Search for specific file types
results = quilt3.search("extension:parquet")

# Search by metadata
results = quilt3.search("metadata.department:research")
```

---

## Utilities and Helpers

### verify\_hash(pkg, registry=None) -> bool  {#verify\_hash}

Verify the integrity of a package by checking file hashes.

**Arguments:**
- `pkg (Package)`: Package object to verify
- `registry (str)`: Registry to verify against

**Returns:** True if all hashes match, False otherwise

**Examples:**

```python
import quilt3

# Install and verify a package
pkg = quilt3.Package.install('username/dataset')
is_valid = quilt3.verify_hash(pkg)

if is_valid:
    print("Package integrity verified")
else:
    print("Package integrity check failed - files may be corrupted")
    
# Verify against specific registry
is_valid = quilt3.verify_hash(pkg, registry='s3://backup-bucket')
```

---

## Common Workflows

### Setting Up a New Environment

```python
import quilt3
import os

def setup_quilt_environment(catalog_url: str, local_dir: str = None):
    """Set up Quilt in a new environment."""
    
    # Configure catalog
    quilt3.config(catalog_url)
    
    # Set local registry if specified
    if local_dir:
        quilt3.config(default_local_registry=local_dir)
    
    # Authenticate
    print(f"Please authenticate to {catalog_url}")
    quilt3.login()
    
    # Verify setup
    if quilt3.logged_in():
        print("✓ Authentication successful")
        
        # Test package listing
        try:
            packages = quilt3.list_packages()
            print(f"✓ Found {len(packages)} packages")
        except Exception as e:
            print(f"⚠ Package listing failed: {e}")
    else:
        print("✗ Authentication failed")

# Usage
setup_quilt_environment('https://your-catalog.com', '~/quilt_data')
```

### Package Discovery and Analysis

```python
import quilt3
from collections import defaultdict

def analyze_registry():
    """Analyze packages in the current registry."""
    
    packages = quilt3.list_packages()
    
    # Analyze by namespace
    namespaces = defaultdict(list)
    for pkg in packages:
        if '/' in pkg:
            namespace, name = pkg.split('/', 1)
            namespaces[namespace].append(name)
    
    print("Registry Analysis:")
    print(f"Total packages: {len(packages)}")
    print(f"Namespaces: {len(namespaces)}")
    
    for namespace, pkg_names in sorted(namespaces.items()):
        print(f"  {namespace}: {len(pkg_names)} packages")
    
    # Find recently updated packages (requires package inspection)
    print("\nSample packages:")
    for pkg_name in packages[:5]:
        try:
            pkg = quilt3.Package.browse(pkg_name)
            print(f"  {pkg_name}: {len(list(pkg))} files")
        except Exception as e:
            print(f"  {pkg_name}: Error browsing - {e}")

# Usage
analyze_registry()
```

### Batch Package Operations

```python
import quilt3
from typing import List

def batch_install_packages(package_names: List[str], dest_dir: str = None):
    """Install multiple packages with error handling."""
    
    results = []
    
    for pkg_name in package_names:
        try:
            print(f"Installing {pkg_name}...")
            pkg = quilt3.Package.install(pkg_name, dest=dest_dir)
            results.append({
                'package': pkg_name,
                'status': 'success',
                'files': len(list(pkg))
            })
            print(f"✓ {pkg_name} installed successfully")
            
        except Exception as e:
            results.append({
                'package': pkg_name,
                'status': 'error',
                'error': str(e)
            })
            print(f"✗ {pkg_name} failed: {e}")
    
    # Summary
    successful = [r for r in results if r['status'] == 'success']
    failed = [r for r in results if r['status'] == 'error']
    
    print(f"\nBatch install complete:")
    print(f"  Successful: {len(successful)}")
    print(f"  Failed: {len(failed)}")
    
    return results

# Usage
packages_to_install = [
    'examples/wellplates',
    'examples/metadata',
    'examples/hurdat'
]
results = batch_install_packages(packages_to_install, dest_dir='./data')
```

---

## Error Handling and Best Practices

### Robust Configuration Management

```python
import quilt3
import os
from typing import Optional

def safe_quilt_setup(catalog_url: str, retry_count: int = 3) -> bool:
    """Safely set up Quilt with retry logic."""
    
    for attempt in range(retry_count):
        try:
            # Configure
            quilt3.config(catalog_url)
            
            # Test configuration
            config = quilt3.config()
            if config.get('navigator_url') != catalog_url:
                raise ValueError("Configuration not set correctly")
            
            print(f"✓ Configuration successful (attempt {attempt + 1})")
            return True
            
        except Exception as e:
            print(f"✗ Configuration attempt {attempt + 1} failed: {e}")
            if attempt == retry_count - 1:
                print("All configuration attempts failed")
                return False
    
    return False

def check_authentication() -> Optional[str]:
    """Check authentication status with detailed information."""
    
    try:
        catalog_url = quilt3.logged_in()
        if catalog_url:
            # Test actual access
            try:
                packages = quilt3.list_packages()
                return f"Authenticated to {catalog_url} with access to {len(packages)} packages"
            except Exception as e:
                return f"Authenticated to {catalog_url} but access test failed: {e}"
        else:
            return "Not authenticated"
    except Exception as e:
        return f"Authentication check failed: {e}"

# Usage
if safe_quilt_setup('https://your-catalog.com'):
    auth_status = check_authentication()
    print(f"Auth status: {auth_status}")
```

### Performance Optimization

```python
import quilt3
import time
from functools import wraps

def timed_operation(func):
    """Decorator to time Quilt operations."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            print(f"✓ {func.__name__} completed in {duration:.2f}s")
            return result
        except Exception as e:
            duration = time.time() - start_time
            print(f"✗ {func.__name__} failed after {duration:.2f}s: {e}")
            raise
    return wrapper

@timed_operation
def optimized_package_listing():
    """List packages with timing."""
    return quilt3.list_packages()

@timed_operation  
def optimized_package_install(package_name: str):
    """Install package with timing."""
    return quilt3.Package.install(package_name)

# Usage
packages = optimized_package_listing()
if packages:
    pkg = optimized_package_install(packages[0])
```

This comprehensive API reference provides practical examples and best practices for all core Quilt3 functionality, making it easy for developers to get started and use Quilt effectively in their workflows.