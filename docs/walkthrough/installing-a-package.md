<!-- markdownlint-disable -->
# Installing and Working with Quilt Packages

This comprehensive guide covers everything you need to know about discovering, installing, and working with Quilt packages. Whether you're new to Quilt or looking to master advanced package operations, this walkthrough will get you up to speed.

## 📋 Table of Contents

- [Understanding Registries](#understanding-registries)
- [Discovering Packages](#discovering-packages)
- [Installing Packages](#installing-packages)
- [Browsing Package Manifests](#browsing-package-manifests)
- [Importing Packages in Python](#importing-packages-in-python)
- [Advanced Operations](#advanced-operations)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## 🏗️ Understanding Registries

As explained in ["Uploading a Package"](uploading-a-package.md), packages are managed using **registries**. Think of registries as "package repositories" similar to npm, PyPI, or Docker Hub, but for data.

**Registry Types:**
- **🏠 Local Registry**: On your machine (`~/.quilt/packages/`)
- **☁️ Remote Registries**: S3 buckets configured for Quilt
- **🌐 Public Registries**: Like `s3://quilt-example` for demos

## 🔍 Discovering Packages

### List Available Packages

Use `list_packages` to see packages available on any registry:


```python
import quilt3 # list local packages
list(quilt3.list_packages())
```




    ['aneesh/cli-push',
     'examples/hurdat',
     'aleksey/hurdat']




### Browse Remote Packages

```python
import quilt3 # list remote packages
packages = list(quilt3.list_packages("s3://quilt-example"))
print(f"Found {len(packages)} packages:")
for pkg in packages[:5]:  # Show first 5
    print(f"  📦 {pkg}")
```

**Expected Output:**
```
Found 6 packages:
  📦 aleksey/hurdat
  📦 examples/hurdat
  📦 quilt/altair
  📦 quilt/hurdat
  📦 quilt/open_fruit
```

### Search for Specific Packages

```python
# Filter packages by namespace
data_packages = [pkg for pkg in packages if 'data' in pkg.lower()]
example_packages = [pkg for pkg in packages if pkg.startswith('examples/')]
```

## 📦 Installing Packages

### Basic Installation

To make a remote package and all of its data available locally, use `install`. This downloads both the package manifest and all data files.

**Example: Installing a Demo Package**

```python
import quilt3

# Install the hurricane data demo package
quilt3.Package.install(
    "examples/hurdat",           # Package name
    "s3://quilt-example",        # Registry URL
)
```

**What happens during installation:**
1. ✅ Downloads package manifest
2. ✅ Downloads all data files to local storage  
3. ✅ Makes package available for local access
4. ✅ Enables offline usage

### Authentication for Private Registries

For private registries, authenticate first:
<!--pytest.mark.skip-->
```python
# only need to run this once
# ie quilt3.config('https://your-catalog-homepage/')
quilt3.config('https://open.quiltdata.com/')

# follow the instructions to finish login
quilt3.login()
```

### Custom Installation Locations

By default, packages install to your local Quilt registry. You can specify a custom destination:

```python
import quilt3

# Install to current directory
quilt3.Package.install(
    "examples/hurdat", 
    "s3://quilt-example", 
    dest="./"                    # Install to current directory
)

# Install to specific path
quilt3.Package.install(
    "examples/hurdat",
    "s3://quilt-example",
    dest="./data/hurricane-data/" # Custom path
)
```

**Use Cases for Custom Destinations:**
- 📁 **Project-specific data**: Keep data with your code
- 🔄 **Temporary analysis**: Download to `/tmp` for one-time use
- 📊 **Shared team folders**: Install to shared network drives

### Version-Specific Installation

Install specific package versions using the top hash:

```python
import quilt3

# Install latest version
latest_pkg = quilt3.Package.install("examples/hurdat", "s3://quilt-example")

# Install specific version by hash
quilt3.Package.install(
    "examples/hurdat", 
    "s3://quilt-example", 
    top_hash="058e62c"           # Specific version hash
)
```

**When to use version-specific installation:**
- 🔒 **Reproducible research**: Lock to exact data versions
- 🐛 **Rollback scenarios**: Revert to known-good versions
- 🧪 **A/B testing**: Compare different data versions


## 👀 Browsing Package Manifests

### Lightweight Package Access

Use `browse` to access package metadata and structure without downloading data files. This is perfect for exploration and selective downloading.

```python
import quilt3

# Browse a package (manifest only)
pkg = quilt3.Package.browse("examples/hurdat", "s3://quilt-example")

# Inspect package structure
print("Package contents:")
for key in pkg:
    print(f"  📄 {key}")

# Check package size without downloading
total_size = sum(pkg[key].size for key in pkg)
print(f"Total package size: {total_size:,} bytes")
```

### Configure Default Registry

Set a default registry to simplify commands:

```python
# Set default registry (persists between sessions)
quilt3.config(default_remote_registry="s3://quilt-example")

# Now you can omit the registry URL
pkg = quilt3.Package.browse("examples/hurdat")
```

### When to Use Browse vs Install

| Operation | Use `browse` | Use `install` |
|-----------|-------------|---------------|
| **Explore package contents** | ✅ Fast, no downloads | ❌ Slow, downloads everything |
| **Check metadata** | ✅ Instant access | ❌ Must download first |
| **Selective file access** | ✅ Download only what you need | ❌ Downloads everything |
| **Offline usage** | ❌ Requires internet | ✅ Works offline |
| **Full data analysis** | ❌ Must fetch files individually | ✅ All data ready |

## 🐍 Importing Packages in Python

### Direct Python Import

Once installed, packages become importable Python modules:

```python
# Import installed package as a module
from quilt3.data.examples import hurdat

# Access package data directly
print("Package imported successfully!")
print(f"Package contains: {len(hurdat)} files")

# Use in data analysis
import pandas as pd
# Example: df = pd.read_csv(hurdat["atlantic.csv"]())
```

**Benefits of Python Import:**
- 🔗 **Unified dependency management**: Data and code together
- 📝 **Cleaner scripts**: No explicit package loading
- 🚀 **Faster startup**: Packages load on-demand
- 📦 **Namespace organization**: Avoid naming conflicts

## ⚡ Advanced Operations

### Batch Package Operations

```python
import quilt3

# Install multiple packages
packages_to_install = [
    ("examples/hurdat", "s3://quilt-example"),
    ("quilt/open_images", "s3://quilt-example"),
]

for pkg_name, registry in packages_to_install:
    print(f"Installing {pkg_name}...")
    quilt3.Package.install(pkg_name, registry)
    print(f"✅ {pkg_name} installed")
```

### Check Installation Status

```python
import quilt3

def check_package_status(pkg_name, registry=None):
    """Check if a package is installed locally."""
    try:
        # Try to browse locally first
        local_pkg = quilt3.Package.browse(pkg_name)
        print(f"✅ {pkg_name} is installed locally")
        return True
    except:
        print(f"❌ {pkg_name} not found locally")
        return False

# Check multiple packages
packages = ["examples/hurdat", "quilt/altair"]
for pkg in packages:
    check_package_status(pkg)
```

### Selective File Installation

```python
import quilt3

# Browse first, then selectively download
pkg = quilt3.Package.browse("examples/hurdat", "s3://quilt-example")

# Download only specific files
pkg["atlantic.csv"].fetch("./data/")
pkg["pacific.csv"].fetch("./data/")

print("Downloaded only the CSV files needed for analysis")
```

## 🔧 Troubleshooting

### Common Installation Issues

#### Issue 1: Authentication Errors
```
Error: Access Denied (403)
```

**Solution:**
```python
# Ensure you're logged in
quilt3.config('https://your-catalog-url.com/')
quilt3.login()

# Verify your access
quilt3.list_packages("s3://your-private-bucket")
```

#### Issue 2: Network Timeouts
```
Error: Connection timeout
```

**Solution:**
```python
# Increase timeout for large packages
import quilt3
quilt3.config(requests_timeout=300)  # 5 minutes

# Or install to local directory to resume interrupted downloads
quilt3.Package.install("large/package", "s3://registry", dest="./temp/")
```

#### Issue 3: Insufficient Disk Space
```
Error: No space left on device
```

**Solution:**
```python
# Check package size before installing
pkg = quilt3.Package.browse("large/package", "s3://registry")
total_size = sum(pkg[key].size for key in pkg)
print(f"Package size: {total_size / (1024**3):.2f} GB")

# Use browse + selective fetch instead of full install
pkg["important_file.csv"].fetch("./")
```

### Performance Tips

#### Optimize Download Speed
```python
# Use parallel downloads for large packages
import quilt3
quilt3.config(
    max_pool_connections=20,    # Increase connection pool
    requests_timeout=300        # Longer timeout for large files
)
```

#### Monitor Installation Progress
```python
import quilt3
from tqdm import tqdm

def install_with_progress(pkg_name, registry):
    """Install package with progress monitoring."""
    print(f"Installing {pkg_name}...")
    
    # Browse first to get file count
    pkg = quilt3.Package.browse(pkg_name, registry)
    file_count = len(pkg)
    
    print(f"Package contains {file_count} files")
    
    # Install (Quilt shows its own progress bars)
    quilt3.Package.install(pkg_name, registry)
    print(f"✅ Installation complete!")

install_with_progress("examples/hurdat", "s3://quilt-example")
```

## 📋 Best Practices

### 1. **Registry Management**
```python
# Set up registry aliases for different environments
quilt3.config(default_remote_registry="s3://prod-data-bucket")

# For development
# quilt3.config(default_remote_registry="s3://dev-data-bucket")
```

### 2. **Version Control Integration**
```python
# Pin package versions in requirements files
# requirements-data.txt:
# examples/hurdat@058e62c
# quilt/altair@a1b2c3d

# Install pinned versions
def install_data_requirements():
    requirements = [
        ("examples/hurdat", "s3://quilt-example", "058e62c"),
        ("quilt/altair", "s3://quilt-example", "a1b2c3d"),
    ]
    
    for pkg_name, registry, version in requirements:
        quilt3.Package.install(pkg_name, registry, top_hash=version)
```

### 3. **Resource Management**
```python
# Clean up old package versions
def cleanup_old_packages():
    """Remove old package versions to save disk space."""
    import shutil
    import os
    
    # Get local registry path
    config = quilt3.config()
    local_registry = config.default_local_registry
    
    print(f"Local registry: {local_registry}")
    print("Note: Manual cleanup required - check Quilt docs for safe removal")
```

### 4. **Team Collaboration**
```python
# Share package installation scripts
def setup_team_environment():
    """Set up standard data packages for team."""
    team_packages = [
        "company/customer-data",
        "company/product-catalog", 
        "external/market-research"
    ]
    
    registry = "s3://company-data-bucket"
    
    for pkg in team_packages:
        print(f"Installing {pkg}...")
        quilt3.Package.install(pkg, registry)
    
    print("✅ Team environment ready!")
```

---

## 🎯 Next Steps

- **[Editing Packages](editing-a-package.md)** - Learn to modify and update packages
- **[Getting Data](getting-data-from-a-package.md)** - Advanced data access patterns  
- **[Uploading Packages](uploading-a-package.md)** - Create and share your own packages
- **[Working with Buckets](working-with-a-bucket.md)** - Direct S3 bucket operations

**Need help?** Join our [Slack community](https://quiltusers.slack.com/) or check the [troubleshooting guide](../Troubleshooting.md).
