<!--pytest-codeblocks:skipfile-->
<!-- markdownlint-disable -->
# Creating and Uploading Quilt Packages

This comprehensive guide covers the complete workflow for creating, building, and sharing Quilt packages. Learn how to package your data effectively and distribute it to your team or the broader community.

## 📋 Table of Contents

- [Package Creation Workflow](#package-creation-workflow)
- [Building Packages Locally](#building-packages-locally)
- [Authentication & Access](#authentication--access)
- [Publishing to Remote Registries](#publishing-to-remote-registries)
- [Advanced Publishing Options](#advanced-publishing-options)
- [Package Management](#package-management)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🔄 Package Creation Workflow

Before uploading, ensure your package is properly structured. The typical workflow is:

1. **📦 Create Package** - Add files and metadata
2. **🔨 Build Locally** - Generate manifest and validate
3. **🔐 Authenticate** - Set up access to remote registry
4. **🚀 Push/Publish** - Share with others
5. **✅ Verify** - Confirm successful upload

Once your package is ready, it's time to save and distribute it.

## 🔨 Building Packages Locally

### Basic Package Building

Use `build` to create a package manifest and validate your package structure:

```python
import quilt3

# Create and populate a package
pkg = quilt3.Package()
pkg.set("data.csv", "./my_data.csv")
pkg.set("README.md", "./README.md")
pkg.set_meta({"description": "My analysis dataset", "version": "1.0"})

# Build the package locally
top_hash = pkg.build("myname/analysis-data")
print(f"Package built with hash: {top_hash}")
```

### Package Naming Convention

Package names must follow the `namespace/packagename` format:

| Component | Description | Examples |
|-----------|-------------|----------|
| **Namespace** | Organization or author | `mycompany`, `jsmith`, `research-team` |
| **Package Name** | Descriptive identifier | `customer-data`, `ml-models`, `survey-results` |

**Naming Best Practices:**
- 🏢 **Organizations**: Use company/team name (`acme/sales-data`)
- 👤 **Individual**: Use your username (`jsmith/research-project`)  
- 📊 **Data Type**: Be descriptive (`marketing/campaign-metrics`)
- 🔢 **Avoid versions in names**: Use metadata instead

### Build Validation

Building performs several validation checks:

```python
import quilt3

pkg = quilt3.Package()
pkg.set("data.csv", "./data.csv")

try:
    # Build with validation
    top_hash = pkg.build("myname/validated-package")
    print("✅ Package validation passed")
    print(f"📋 Manifest created with hash: {top_hash}")
except Exception as e:
    print(f"❌ Validation failed: {e}")
```

**What gets validated:**
- ✅ Package name format
- ✅ File accessibility  
- ✅ Metadata structure
- ✅ Logical key uniqueness

## 🔐 Authentication & Access

### Setting Up Registry Access

Before publishing to remote registries, configure authentication:

```python
import quilt3

# Configure your Quilt catalog URL
quilt3.config('https://your-catalog-homepage.com/')

# Authenticate (opens browser for login)
quilt3.login()

# Verify authentication
print("✅ Authentication successful!")
```

### Registry Types and Authentication

| Registry Type | Authentication Method | Use Case |
|---------------|----------------------|----------|
| **Public** | None required | Open datasets, demos |
| **Private S3** | AWS credentials + Quilt login | Team/company data |
| **Enterprise** | SSO + Quilt login | Large organizations |

### AWS Credentials Setup

For S3-backed registries, ensure AWS credentials are configured:

```bash
# Option 1: AWS CLI
aws configure

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=us-east-1

# Option 3: IAM roles (recommended for EC2/Lambda)
# No additional setup needed
```

### Verify Access Permissions

```python
import quilt3

def check_registry_access(registry_url):
    """Verify read/write access to a registry."""
    try:
        # Test read access
        packages = list(quilt3.list_packages(registry_url))
        print(f"✅ Read access confirmed - found {len(packages)} packages")
        
        # Test write access (create a test package)
        test_pkg = quilt3.Package()
        test_pkg.set_meta({"test": True})
        
        # This will fail if no write access
        test_pkg.build("test/access-check", registry_url)
        print("✅ Write access confirmed")
        
        return True
    except Exception as e:
        print(f"❌ Access denied: {e}")
        return False

# Test your registry
check_registry_access("s3://your-bucket")

## 🚀 Publishing to Remote Registries

### Basic Package Publishing

Use `push` to upload both package manifest and data files to a remote registry:

```python
import quilt3

# Create and populate package
pkg = quilt3.Package()
pkg.set("analysis.csv", "./data/analysis.csv")
pkg.set("README.md", "./README.md")
pkg.set_meta({
    "description": "Q3 2024 sales analysis",
    "author": "Data Team",
    "version": "1.0.0"
})

# Push to remote registry
pkg.push(
    "company/sales-analysis-q3",        # Package name
    "s3://company-data-bucket",         # Registry URL
    message="Initial release of Q3 analysis"  # Commit message
)

print("✅ Package published successfully!")
```

### Configure Default Registry

Simplify commands by setting a default registry:

```python
# Set default registry (persists between sessions)
quilt3.config(default_remote_registry='s3://company-data-bucket')

# Now you can omit the registry URL
pkg = quilt3.Package()
pkg.set("data.csv", "./data.csv")
pkg.push("myname/dataset", message="Added new dataset")
```

### Custom Destination Paths

Control where files are stored in S3:

```python
import quilt3

pkg = quilt3.Package()
pkg.set("data.csv", "./data.csv")

# Push to specific S3 path
pkg.push(
    "myname/dataset",
    dest="s3://company-bucket/projects/ml-project/"
)

# Files will be stored under: s3://company-bucket/projects/ml-project/
```

**Advanced Path Control:**
- 📁 **Project organization**: Group related packages
- 🗓️ **Date-based paths**: `s3://bucket/2024/Q3/`
- 🏢 **Department separation**: `s3://bucket/marketing/`
- 🔄 **Environment staging**: `s3://bucket/dev/`, `s3://bucket/prod/`

> **Pro Tip**: For fine-grained control over individual file paths, see [Materialization](../advanced-features/materialization.md).

## 📋 Advanced Publishing Options

### Manifest-Only Publishing

Use `build` to save only the package manifest without copying data files:

```python
import quilt3

# Create package with references to existing S3 data
pkg = quilt3.Package()
pkg.set("existing_data.csv", "s3://data-lake/raw/data.csv")
pkg.set("processed.parquet", "s3://data-lake/processed/output.parquet")

# Build manifest only (no data copying)
pkg.build("myname/data-references", "s3://company-registry")

print("✅ Manifest published - data files remain in original locations")
```

**When to use manifest-only publishing:**
- 📊 **Large datasets**: Avoid expensive data transfers
- 🔗 **Data lake integration**: Reference existing S3 objects
- 🚀 **Fast publishing**: Instant package creation
- 💰 **Cost optimization**: Minimize S3 transfer costs

### Incremental Updates

Update packages efficiently by building on existing versions:

```python
import quilt3

# Load existing package
pkg = quilt3.Package.browse("myname/dataset", "s3://registry")

# Add new files
pkg.set("new_analysis.csv", "./latest_analysis.csv")
pkg.set_meta({"version": "1.1.0", "updated": "2024-08-26"})

# Push update
pkg.push("myname/dataset", message="Added Q3 analysis results")
```

### Batch Publishing

Publish multiple packages efficiently:

```python
import quilt3
from pathlib import Path

def publish_project_datasets(project_dir, registry):
    """Publish all datasets in a project directory."""
    project_path = Path(project_dir)
    
    for dataset_dir in project_path.iterdir():
        if dataset_dir.is_dir():
            pkg = quilt3.Package()
            
            # Add all files in dataset directory
            pkg.set_dir(".", str(dataset_dir))
            
            # Set metadata from directory name
            pkg.set_meta({
                "dataset": dataset_dir.name,
                "project": project_path.name,
                "created": "2024-08-26"
            })
            
            # Publish
            pkg_name = f"project/{dataset_dir.name}"
            pkg.push(pkg_name, registry, message=f"Published {dataset_dir.name}")
            print(f"✅ Published {pkg_name}")

# Publish all datasets
publish_project_datasets("./ml-project/datasets/", "s3://company-registry")
```

## 🗂️ Package Management

### Package Versioning Strategy

```python
import quilt3

def create_versioned_package(name, registry, version, data_files):
    """Create a package with proper versioning metadata."""
    pkg = quilt3.Package()
    
    # Add data files
    for logical_key, physical_path in data_files.items():
        pkg.set(logical_key, physical_path)
    
    # Add version metadata
    pkg.set_meta({
        "version": version,
        "created_at": "2024-08-26T10:00:00Z",
        "schema_version": "1.0",
        "changelog": f"Version {version} release"
    })
    
    # Push with descriptive message
    message = f"Release version {version}"
    pkg.push(name, registry, message=message)
    
    return pkg

# Example usage
data_files = {
    "customers.csv": "./data/customers.csv",
    "orders.csv": "./data/orders.csv",
    "README.md": "./README.md"
}

create_versioned_package(
    "company/customer-data", 
    "s3://company-registry",
    "2.1.0",
    data_files
)
```

### Package Deletion

Remove packages from registries when no longer needed:

```python
import quilt3

def safe_delete_package(pkg_name, registry=None):
    """Safely delete a package with confirmation."""
    try:
        # Check if package exists
        pkg = quilt3.Package.browse(pkg_name, registry)
        file_count = len(pkg)
        
        print(f"Package '{pkg_name}' contains {file_count} files")
        confirm = input("Are you sure you want to delete? (yes/no): ")
        
        if confirm.lower() == 'yes':
            if registry:
                quilt3.delete_package(pkg_name, registry)
                print(f"✅ Deleted {pkg_name} from {registry}")
            else:
                quilt3.delete_package(pkg_name)
                print(f"✅ Deleted {pkg_name} from local registry")
        else:
            print("❌ Deletion cancelled")
            
    except Exception as e:
        print(f"❌ Error: {e}")

# Delete from local registry
safe_delete_package("myname/old-dataset")

# Delete from remote registry  
safe_delete_package("myname/old-dataset", "s3://company-registry")
```

**⚠️ Important Notes:**
- Deletion only removes the **package manifest**
- **Data files remain** in their original S3 locations
- **Deletion is permanent** - no undo functionality
- Consider **archiving** instead of deleting for important data

## 📋 Best Practices

### 1. **Package Organization**

```python
# Good: Descriptive, hierarchical naming
"marketing/campaign-2024-q3"
"research/clinical-trial-phase2" 
"finance/quarterly-reports"

# Bad: Vague or version-specific names
"data"
"dataset-v2"
"final-data-really-final"
```

### 2. **Metadata Standards**

```python
import quilt3
from datetime import datetime

def create_standard_package(name, description, author, files):
    """Create package with standardized metadata."""
    pkg = quilt3.Package()
    
    # Add files
    for logical_key, physical_path in files.items():
        pkg.set(logical_key, physical_path)
    
    # Standard metadata schema
    metadata = {
        "description": description,
        "author": author,
        "created_at": datetime.utcnow().isoformat(),
        "schema_version": "1.0",
        "tags": [],
        "license": "proprietary",
        "contact": "data-team@company.com"
    }
    
    pkg.set_meta(metadata)
    return pkg
```

### 3. **Commit Message Guidelines**

```python
# Good commit messages
pkg.push("data/sales", message="Add Q3 2024 sales data with regional breakdowns")
pkg.push("ml/models", message="Update model weights after hyperparameter tuning")
pkg.push("research/survey", message="Fix data quality issues in demographics table")

# Bad commit messages  
pkg.push("data/sales", message="update")
pkg.push("ml/models", message="changes")
pkg.push("research/survey", message="fix")
```

### 4. **Security and Access Control**

```python
import quilt3

def publish_with_access_control(pkg_name, registry, sensitivity_level):
    """Publish package with appropriate access controls."""
    
    # Validate registry based on sensitivity
    if sensitivity_level == "public":
        allowed_registries = ["s3://public-data-bucket"]
    elif sensitivity_level == "internal":
        allowed_registries = ["s3://company-internal-bucket"]
    elif sensitivity_level == "confidential":
        allowed_registries = ["s3://company-secure-bucket"]
    else:
        raise ValueError("Invalid sensitivity level")
    
    if registry not in allowed_registries:
        raise ValueError(f"Registry {registry} not allowed for {sensitivity_level} data")
    
    # Add security metadata
    pkg = quilt3.Package()
    pkg.set_meta({
        "sensitivity": sensitivity_level,
        "data_classification": sensitivity_level.upper(),
        "access_policy": f"Restricted to {sensitivity_level} access only"
    })
    
    return pkg

# Example usage
pkg = publish_with_access_control(
    "finance/budget-data",
    "s3://company-secure-bucket", 
    "confidential"
)
```

## 🔧 Troubleshooting

### Common Publishing Issues

#### Issue 1: Authentication Failures
```
Error: Access Denied (403)
```

**Solutions:**
```python
# Check authentication status
import quilt3
config = quilt3.config()
print(f"Catalog URL: {config.navigator_url}")

# Re-authenticate
quilt3.login()

# Verify AWS credentials
import boto3
try:
    s3 = boto3.client('s3')
    s3.list_buckets()
    print("✅ AWS credentials valid")
except Exception as e:
    print(f"❌ AWS credentials issue: {e}")
```

#### Issue 2: Large File Upload Failures
```
Error: Connection timeout during upload
```

**Solutions:**
```python
# Increase timeouts for large files
quilt3.config(
    requests_timeout=600,        # 10 minutes
    max_pool_connections=10      # More concurrent connections
)

# Use multipart upload for large files (automatic for files >100MB)
# Or split large files into smaller chunks
```

#### Issue 3: Package Name Conflicts
```
Error: Package already exists
```

**Solutions:**
```python
# Check existing packages
existing = list(quilt3.list_packages("s3://registry"))
print("Existing packages:", existing)

# Use versioned naming or update existing package
pkg = quilt3.Package.browse("existing/package", "s3://registry")
pkg.set("new_file.csv", "./new_data.csv")
pkg.push("existing/package", message="Added new data file")
```

### Performance Optimization

```python
import quilt3

# Optimize for large datasets
def optimize_large_package_upload():
    """Configure Quilt for optimal large file performance."""
    
    # Increase connection limits
    quilt3.config(
        max_pool_connections=20,
        requests_timeout=900,  # 15 minutes
        multipart_threshold=100 * 1024 * 1024,  # 100MB
        multipart_chunksize=50 * 1024 * 1024    # 50MB chunks
    )
    
    print("✅ Optimized for large file uploads")

# Monitor upload progress
def upload_with_monitoring(pkg, name, registry):
    """Upload package with progress monitoring."""
    import time
    
    start_time = time.time()
    
    try:
        pkg.push(name, registry, message="Monitored upload")
        
        duration = time.time() - start_time
        print(f"✅ Upload completed in {duration:.2f} seconds")
        
    except Exception as e:
        duration = time.time() - start_time
        print(f"❌ Upload failed after {duration:.2f} seconds: {e}")
        raise
```

---

## 🎯 Next Steps

- **[Installing Packages](installing-a-package.md)** - Learn to download and use packages
- **[Editing Packages](editing-a-package.md)** - Modify existing packages
- **[Working with Buckets](working-with-a-bucket.md)** - Direct S3 operations
- **[Advanced Features](../advanced-features/)** - Workflows, schemas, and automation

**Need help?** Join our [Slack community](https://quiltusers.slack.com/) or check the [troubleshooting guide](../Troubleshooting.md).
