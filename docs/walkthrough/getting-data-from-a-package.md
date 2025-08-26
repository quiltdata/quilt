<!-- markdownlint-disable -->
# Getting Data from Quilt Packages

This comprehensive guide covers all aspects of accessing, downloading, and working with data from Quilt packages. Learn efficient data access patterns, performance optimization techniques, and advanced usage scenarios.

## 📋 Table of Contents

- [Package Navigation](#package-navigation)
- [Data Access Patterns](#data-access-patterns)
- [Download Strategies](#download-strategies)
- [In-Memory Data Loading](#in-memory-data-loading)
- [Performance Optimization](#performance-optimization)
- [Advanced Access Patterns](#advanced-access-patterns)
- [Integration Patterns](#integration-patterns)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🧭 Package Navigation

The examples in this section use the `aleksey/hurdat` [demo package](https://open.quiltdata.com/b/quilt-example/tree/aleksey/hurdat/):


```python
import quilt3
p = quilt3.Package.browse('aleksey/hurdat', 's3://quilt-example')
p
```

    Loading manifest: 100%|██████████| 7/7 [00:00<00:00, 8393.40entries/s]





    (remote Package)
     └─.gitignore
     └─.quiltignore
     └─notebooks/
       └─QuickStart.ipynb
     └─quilt_summarize.json
     └─requirements.txt
     └─scripts/
       └─build.py



## 🔍 Data Access Patterns

### Dictionary-Style Access

Use `dict` key selection to slice into a package tree:
<!--pytest-codeblocks:cont-->


```python
import quilt3

pkg = quilt3.Package.browse('aleksey/hurdat', 's3://quilt-example')

# Access individual files - returns PackageEntry
requirements_file = pkg["requirements.txt"]
print(f"📄 File: {requirements_file}")
print(f"🔗 Location: {requirements_file.get()}")

# Access directories - returns Package
notebooks_dir = pkg["notebooks"]
print(f"📁 Directory: {notebooks_dir}")
print(f"📊 Contains {len(notebooks_dir)} files")

# List directory contents
for file_key in notebooks_dir:
    print(f"  📄 {file_key}")
```

**Key Concepts:**
- 📄 **File Access**: `pkg["file.txt"]` returns a `PackageEntry`
- 📁 **Directory Access**: `pkg["folder"]` returns a `Package` rooted at that subdirectory
- 🔗 **Path Resolution**: Use `.get()` to get the actual file path/URL

### Nested Navigation

Navigate deep into package hierarchies:

```python
import quilt3

pkg = quilt3.Package.browse('aleksey/hurdat', 's3://quilt-example')

# Navigate to nested files
notebook_file = pkg["notebooks"]["QuickStart.ipynb"]
print(f"📓 Notebook: {notebook_file}")

# Check if paths exist before accessing
def safe_access(pkg, path_parts):
    """Safely navigate package hierarchy."""
    current = pkg
    
    for part in path_parts:
        if part in current:
            current = current[part]
            print(f"✅ Found: {part}")
        else:
            print(f"❌ Not found: {part}")
            return None
    
    return current

# Example usage
result = safe_access(pkg, ["notebooks", "QuickStart.ipynb"])
if result:
    print(f"🎯 Successfully accessed: {result}")
```

## 💾 Download Strategies

### Basic File Downloads

Use `fetch` to download files and directories to disk:
<!--pytest-codeblocks:cont-->


```python
# download a subfolder
p["notebooks"].fetch()

# download a single file
p["notebooks"]["QuickStart.ipynb"].fetch()

# download everything
p.fetch()
```

    Copying objects: 100%|██████████| 36.7k/36.7k [00:01<00:00, 22.7kB/s]
    100%|██████████| 36.7k/36.7k [00:01<00:00, 24.1kB/s]
    Copying objects: 100%|██████████| 39.9k/39.9k [00:02<00:00, 16.5kB/s]





    (local Package)
     └─.gitignore
     └─.quiltignore
     └─notebooks/
       └─QuickStart.ipynb
     └─quilt_summarize.json
     └─requirements.txt
     └─scripts/
       └─build.py



### Custom Download Locations

`fetch` defaults to the current directory, but you can specify custom destinations:
<!--pytest-codeblocks:cont-->


```python
p["notebooks"]["QuickStart.ipynb"].fetch("./references/")
```

    100%|██████████| 36.7k/36.7k [00:01<00:00, 22.5kB/s]





    PackageEntry('file:///Users/gregezema/Documents/programs/quilt/docs/Walkthrough/references/')



## Downloading package data into memory

Alternatively, you can download data directly into memory:
<!--pytest-codeblocks:cont-->


```python
p["quilt_summarize.json"].deserialize()
```




    ['notebooks/QuickStart.ipynb']



To apply a custom deserializer to your data, pass the function as a parameter to the function. For example, to load a hypothetical `yaml` file using `yaml.safe_load`:
<!--pytest-codeblocks:cont-->


```python
import yaml
# returns a dict
p["quilt_summarize.json"].deserialize(yaml.safe_load)
```




    ['notebooks/QuickStart.ipynb']



The deserializer should accept a byte stream as input.

## Getting entry locations

You can get the path to a package entry or directory using `get`:
<!--pytest-codeblocks:cont-->


```python
# returns /path/to/pkg/root/notebooks/QuickStart.ipynb
p["notebooks"]["QuickStart.ipynb"].get()
```




    's3://quilt-example/aleksey/hurdat/notebooks/QuickStart.ipynb?versionId=PH.9gsCH6LM9RQIqsy1U4X6H6s.VoQ_B'



## Getting metadata

Metadata is available using the `meta` property.
<!--pytest-codeblocks:cont-->


```python
import quilt3

pkg = quilt3.Package.browse('aleksey/hurdat', 's3://quilt-example')

# Get file metadata
file_meta = pkg["notebooks"]["QuickStart.ipynb"].meta
print(f"📄 File metadata: {file_meta}")

# Get directory metadata
dir_meta = pkg["notebooks"].meta
print(f"📁 Directory metadata: {dir_meta}")

# Get package metadata
pkg_meta = pkg.meta
print(f"📦 Package metadata: {pkg_meta}")
```

## ⚡ Performance Optimization

### Selective Data Loading

Load only the data you need to optimize performance:

```python
import quilt3

def smart_data_loader(pkg, file_patterns, max_size_mb=100):
    """Load data selectively based on patterns and size limits."""
    loaded_files = {}
    skipped_files = []
    
    for key in pkg:
        # Check if file matches any pattern
        matches_pattern = any(key.endswith(pattern.replace('*', '')) for pattern in file_patterns)
        
        if matches_pattern:
            try:
                # Check file size
                file_size_mb = pkg[key].size / (1024 * 1024)
                
                if file_size_mb <= max_size_mb:
                    # Load file into memory
                    data = pkg[key].deserialize()
                    loaded_files[key] = data
                    print(f"✅ Loaded {key} ({file_size_mb:.2f} MB)")
                else:
                    skipped_files.append((key, file_size_mb))
                    print(f"⚠️ Skipped {key} (too large: {file_size_mb:.2f} MB)")
                    
            except Exception as e:
                print(f"❌ Error loading {key}: {e}")
    
    return loaded_files, skipped_files

# Example usage
pkg = quilt3.Package.browse('aleksey/hurdat', 's3://quilt-example')
patterns = ['.json', '.txt']
loaded, skipped = smart_data_loader(pkg, patterns, max_size_mb=10)
```

### Error Handling Best Practices

```python
def robust_data_loader(pkg, file_key):
    """Load data with comprehensive error handling."""
    try:
        # Check if file exists
        if file_key not in pkg:
            raise FileNotFoundError(f"File not found: {file_key}")
        
        # Check file size
        file_size = pkg[file_key].size
        if file_size > 100 * 1024 * 1024:  # 100MB
            print(f"⚠️ Large file warning: {file_size / (1024**2):.2f} MB")
        
        # Load data
        data = pkg[file_key].deserialize()
        print(f"✅ Successfully loaded {file_key}")
        return data
        
    except FileNotFoundError as e:
        print(f"❌ File error: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error loading {file_key}: {e}")
        return None

# Example usage
data = robust_data_loader(pkg, 'quilt_summarize.json')
if data is not None:
    print(f"Data loaded: {type(data)}")
```

---

## 🎯 Next Steps

- **[Editing Packages](editing-a-package.md)** - Learn to modify and update packages
- **[Uploading Packages](uploading-a-package.md)** - Create and share your own packages
- **[Working with Buckets](working-with-a-bucket.md)** - Direct S3 bucket operations
- **[Advanced Features](../advanced-features/)** - Workflows, schemas, and automation

**Need help?** Join our [Slack community](https://quiltusers.slack.com/) or check the [troubleshooting guide](../Troubleshooting.md).
