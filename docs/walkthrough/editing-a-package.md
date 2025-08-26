<!-- markdownlint-disable -->
# Editing and Managing Quilt Packages

This comprehensive guide covers everything you need to know about creating, editing, and managing Quilt packages. Learn advanced techniques for package manipulation, metadata management, and collaborative workflows.

## 📋 Table of Contents

- [Package Fundamentals](#package-fundamentals)
- [Creating New Packages](#creating-new-packages)
- [Editing Existing Packages](#editing-existing-packages)
- [Adding and Managing Files](#adding-and-managing-files)
- [Metadata Management](#metadata-management)
- [Advanced Editing Techniques](#advanced-editing-techniques)
- [Collaborative Workflows](#collaborative-workflows)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 📦 Package Fundamentals

Data in Quilt is organized in terms of **data packages**. A data package is a logical group of files, directories, and metadata that represents a cohesive dataset or collection of related resources.

## 🆕 Creating New Packages

### Initialize an Empty Package

Create a new package from scratch using the package constructor:

```python
import quilt3

# Create a new empty package
pkg = quilt3.Package()

# Verify it's empty
print(f"Package contains {len(pkg)} files")
print("Package structure:")
print(pkg)
```

### Package Creation Patterns

```python
import quilt3
from datetime import datetime

def create_project_package(project_name, description, author):
    """Create a standardized project package."""
    pkg = quilt3.Package()
    
    # Set standard metadata
    pkg.set_meta({
        "project": project_name,
        "description": description,
        "author": author,
        "created_at": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "status": "draft"
    })
    
    return pkg

# Example usage
pkg = create_project_package(
    "customer-analysis-2024",
    "Comprehensive customer behavior analysis for Q3 2024",
    "Data Science Team"
)
```

## ✏️ Editing Existing Packages

### Load Existing Packages

To edit a preexisting package, first install or browse it:


```python
import quilt3
quilt3.Package.install(
    "examples/hurdat",
    "s3://quilt-example",
)
```

    Loading manifest: 100%|██████████| 5/5 [00:00<00:00, 5902.48entries/s]

    Successfully installed package 'examples/hurdat', tophash=f8d1478 from s3://quilt-example


    


### Browse for Editing

Use `browse` to load a package for editing without downloading all files:

```python
# Browse an existing package for editing
pkg = quilt3.Package.browse('examples/hurdat', 's3://quilt-example')

# Inspect current structure
print("Current package contents:")
for key in pkg:
    print(f"  📄 {key}")

# Check package metadata
print(f"Package metadata: {pkg.meta}")
```

### Copy and Modify Pattern

Create new packages based on existing ones:

```python
import quilt3

def create_derived_package(source_name, source_registry, new_name):
    """Create a new package based on an existing one."""
    
    # Load the source package
    source_pkg = quilt3.Package.browse(source_name, source_registry)
    
    # Create new package with same structure
    new_pkg = quilt3.Package()
    
    # Copy all files from source
    for key in source_pkg:
        new_pkg.set(key, source_pkg[key].get())
    
    # Copy and modify metadata
    source_meta = source_pkg.meta.copy()
    source_meta.update({
        "derived_from": source_name,
        "created_at": "2024-08-26T10:00:00Z",
        "status": "derived"
    })
    new_pkg.set_meta(source_meta)
    
    return new_pkg

# Example usage
derived_pkg = create_derived_package(
    "examples/hurdat", 
    "s3://quilt-example",
    "myteam/hurdat-analysis"
)
```

For more information on accessing existing packages see "[Installing a Package](installing-a-package.md)".

## 📁 Adding and Managing Files

### Individual File Operations

Use `set` to add individual files with precise control:



```python
import quilt3
import tempfile
import os

# Create a new package
pkg = quilt3.Package()

# Add individual files with different sources
pkg.set("local_data.csv", "./data/sales.csv")           # Local file
pkg.set("remote_image.png", "s3://bucket/images/logo.png")  # S3 object
pkg.set("analysis.py", "./scripts/analysis.py")        # Script file

# Add files with custom metadata
pkg.set("important.csv", "./critical_data.csv", meta={
    "importance": "high",
    "last_validated": "2024-08-26",
    "data_quality": "verified"
})

print("Files added individually:")
for key in pkg:
    print(f"  📄 {key}")
```

### Directory Operations

Use `set_dir` to add entire directories efficiently:

```python
import quilt3

pkg = quilt3.Package()

# Add entire directories
pkg.set_dir("data/", "./project_data/")           # Local directory
pkg.set_dir("models/", "s3://ml-bucket/models/")  # S3 directory
pkg.set_dir("docs/", "./documentation/")          # Documentation

# Add directory with metadata
pkg.set_dir("experiments/", "./exp_results/", meta={
    "experiment_batch": "2024-Q3",
    "methodology": "A/B testing",
    "status": "completed"
})

print("Package structure after adding directories:")
print(pkg)
```

### Smart File Addition Patterns

```python
import quilt3
from pathlib import Path

def add_project_structure(pkg, project_dir):
    """Add a standard project structure to a package."""
    project_path = Path(project_dir)
    
    # Add data files
    data_dir = project_path / "data"
    if data_dir.exists():
        pkg.set_dir("data/", str(data_dir))
    
    # Add notebooks
    notebooks_dir = project_path / "notebooks"
    if notebooks_dir.exists():
        pkg.set_dir("notebooks/", str(notebooks_dir))
    
    # Add individual important files
    for important_file in ["README.md", "requirements.txt", "config.yaml"]:
        file_path = project_path / important_file
        if file_path.exists():
            pkg.set(important_file, str(file_path))
    
    return pkg

# Example usage
pkg = quilt3.Package()
pkg = add_project_structure(pkg, "./my_ml_project/")
```




    (remote Package)
     └─banner.png
     └─data.csv
     └─imgs/
       └─banner.png
     └─stuff/



The first parameter to these functions is the *logical key*, which will determine where the file lives within the package. So after running the commands above our package will look like this:
<!--pytest-codeblocks:cont-->


```python
p
```




    (remote Package)
     └─banner.png
     └─data.csv
     └─imgs/
       └─banner.png
     └─stuff/



The second parameter is the *physical key*, which states the file's actual location. The physical key may point to either a local file or a remote object (with an `s3://` path).

If the physical key and the logical key are the same, you may omit the second argument:


```python
import quilt3
p = quilt3.Package()
p.set("data.csv")
```




    (local Package)
     └─data.csv



Another useful trick. Use `"."` to set the contents of the package to that of the current directory:
<!--pytest-codeblocks:cont-->


```python
# create a test file in test directory
with open("new_data.csv", "w") as f:
    f.write("id, value\na, 42")

# set the contents of the package to that of the current directory
p.set_dir(".", ".")
```




    (local Package)
     └─data.csv
     └─new_data.csv



## Deleting data in a package

Use `delete` to remove entries from a package:
<!--pytest-codeblocks:cont-->


```python
p.delete("data.csv")
```




    (local Package)
     └─new_data.csv



Note that this will only remove this piece of data from the package. It will not delete the actual data itself.

## Adding metadata to a package

Packages support metadata anywhere in the package. To set metadata on package entries or directories, use the `meta` argument:


```python
import quilt3
p = quilt3.Package()
p.set("data.csv", "new_data.csv", meta={"type": "csv"})
p.set_dir("subdir/", "subdir/", meta={"origin": "unknown"})
```




    (local Package)
     └─data.csv
     └─subdir/



### Package-Level Metadata

Set metadata on the entire package using `set_meta`:

```python
import quilt3
from datetime import datetime

pkg = quilt3.Package()

# Comprehensive package metadata
package_metadata = {
    "title": "Customer Analysis Dataset",
    "description": "Comprehensive customer behavior analysis for Q3 2024",
    "version": "2.1.0",
    "author": "Data Science Team",
    "created_at": datetime.utcnow().isoformat(),
    "tags": ["customer", "analysis", "q3-2024"],
    "license": "MIT",
    "contact": "data-team@company.com",
    "data_sources": ["CRM", "web_analytics", "surveys"],
    "quality_score": 0.95,
    "schema_version": "1.0"
}

pkg.set_meta(package_metadata)
print("✅ Package metadata set")
```

## 🚀 Advanced Editing Techniques

### Conditional File Addition

```python
import quilt3
import os
from pathlib import Path

def add_files_conditionally(pkg, base_dir, file_patterns, conditions):
    """Add files based on conditions and patterns."""
    base_path = Path(base_dir)
    
    for pattern, condition in zip(file_patterns, conditions):
        matching_files = list(base_path.glob(pattern))
        
        for file_path in matching_files:
            if condition(file_path):
                # Create logical key from relative path
                logical_key = str(file_path.relative_to(base_path))
                
                # Add file with metadata about the condition
                pkg.set(logical_key, str(file_path), meta={
                    "pattern": pattern,
                    "condition_met": True,
                    "file_size": file_path.stat().st_size
                })
                print(f"✅ Added {logical_key}")

# Example usage
pkg = quilt3.Package()

# Define conditions
conditions = [
    lambda p: p.suffix == '.csv' and p.stat().st_size > 1024,  # CSV files > 1KB
    lambda p: p.suffix == '.py' and 'test' not in p.name,     # Non-test Python files
    lambda p: p.name.startswith('README')                      # README files
]

patterns = ['**/*.csv', '**/*.py', '**/README*']

add_files_conditionally(pkg, './project/', patterns, conditions)
```

### Batch File Operations

```python
import quilt3
import pandas as pd
from pathlib import Path

def batch_add_with_validation(pkg, file_list, validator_func):
    """Add multiple files with validation."""
    results = {"added": [], "skipped": [], "errors": []}
    
    for file_info in file_list:
        logical_key = file_info["logical_key"]
        physical_path = file_info["physical_path"]
        
        try:
            # Validate file before adding
            if validator_func(physical_path):
                pkg.set(logical_key, physical_path, meta=file_info.get("meta", {}))
                results["added"].append(logical_key)
                print(f"✅ Added {logical_key}")
            else:
                results["skipped"].append(logical_key)
                print(f"⚠️ Skipped {logical_key} (validation failed)")
                
        except Exception as e:
            results["errors"].append({"file": logical_key, "error": str(e)})
            print(f"❌ Error adding {logical_key}: {e}")
    
    return results

# Example validator
def validate_csv_file(file_path):
    """Validate CSV files have required columns."""
    try:
        df = pd.read_csv(file_path)
        required_columns = ['id', 'timestamp']
        return all(col in df.columns for col in required_columns)
    except:
        return False

# Example usage
files_to_add = [
    {
        "logical_key": "sales_data.csv",
        "physical_path": "./data/sales.csv",
        "meta": {"source": "CRM", "validated": True}
    },
    {
        "logical_key": "customer_data.csv", 
        "physical_path": "./data/customers.csv",
        "meta": {"source": "database", "validated": True}
    }
]

pkg = quilt3.Package()
results = batch_add_with_validation(pkg, files_to_add, validate_csv_file)
print(f"Summary: {len(results['added'])} added, {len(results['skipped'])} skipped")
```

### Package Transformation

```python
import quilt3

def transform_package_structure(source_pkg, transformation_rules):
    """Transform package structure based on rules."""
    new_pkg = quilt3.Package()
    
    for old_key in source_pkg:
        # Apply transformation rules
        new_key = old_key
        for rule in transformation_rules:
            new_key = rule(new_key)
        
        # Copy file with new key
        if new_key:  # Skip if rule returns None
            new_pkg.set(new_key, source_pkg[old_key].get())
            print(f"Transformed: {old_key} → {new_key}")
    
    # Copy metadata
    new_pkg.set_meta(source_pkg.meta.copy())
    
    return new_pkg

# Example transformation rules
def reorganize_by_type(key):
    """Reorganize files by type into subdirectories."""
    if key.endswith('.csv'):
        return f"data/{key}"
    elif key.endswith('.py'):
        return f"scripts/{key}"
    elif key.endswith('.md'):
        return f"docs/{key}"
    return key

def add_version_prefix(key):
    """Add version prefix to files."""
    return f"v2.0/{key}"

# Apply transformations
source_pkg = quilt3.Package.browse("examples/hurdat", "s3://quilt-example")
transformation_rules = [reorganize_by_type, add_version_prefix]
transformed_pkg = transform_package_structure(source_pkg, transformation_rules)
```

## 👥 Collaborative Workflows

### Package Merging

```python
import quilt3

def merge_packages(packages, merge_strategy="latest"):
    """Merge multiple packages into one."""
    merged_pkg = quilt3.Package()
    file_sources = {}
    
    for i, pkg in enumerate(packages):
        pkg_name = f"package_{i}"
        
        for key in pkg:
            if key not in merged_pkg or merge_strategy == "latest":
                merged_pkg.set(key, pkg[key].get())
                file_sources[key] = pkg_name
                print(f"Added {key} from {pkg_name}")
            elif merge_strategy == "skip_duplicates":
                print(f"Skipped duplicate {key}")
    
    # Add merge metadata
    merged_pkg.set_meta({
        "merge_strategy": merge_strategy,
        "source_packages": len(packages),
        "file_sources": file_sources,
        "merged_at": "2024-08-26T10:00:00Z"
    })
    
    return merged_pkg

# Example usage
pkg1 = quilt3.Package.browse("team/dataset-a", "s3://registry")
pkg2 = quilt3.Package.browse("team/dataset-b", "s3://registry")

merged = merge_packages([pkg1, pkg2], merge_strategy="latest")
```

### Conflict Resolution

```python
import quilt3

def resolve_package_conflicts(pkg1, pkg2, resolution_strategy):
    """Resolve conflicts when merging packages."""
    resolved_pkg = quilt3.Package()
    conflicts = []
    
    # Get all unique keys
    all_keys = set(pkg1.keys()) | set(pkg2.keys())
    
    for key in all_keys:
        in_pkg1 = key in pkg1
        in_pkg2 = key in pkg2
        
        if in_pkg1 and in_pkg2:
            # Conflict detected
            conflicts.append(key)
            
            if resolution_strategy == "prefer_first":
                resolved_pkg.set(key, pkg1[key].get())
                source = "pkg1"
            elif resolution_strategy == "prefer_second":
                resolved_pkg.set(key, pkg2[key].get())
                source = "pkg2"
            elif resolution_strategy == "rename_both":
                resolved_pkg.set(f"pkg1_{key}", pkg1[key].get())
                resolved_pkg.set(f"pkg2_{key}", pkg2[key].get())
                source = "both_renamed"
            
            print(f"⚠️ Conflict resolved for {key}: {source}")
            
        elif in_pkg1:
            resolved_pkg.set(key, pkg1[key].get())
        else:
            resolved_pkg.set(key, pkg2[key].get())
    
    # Add conflict resolution metadata
    resolved_pkg.set_meta({
        "conflicts_detected": len(conflicts),
        "resolution_strategy": resolution_strategy,
        "conflicted_files": conflicts
    })
    
    return resolved_pkg, conflicts

# Example usage
pkg1 = quilt3.Package.browse("team/version-a", "s3://registry")
pkg2 = quilt3.Package.browse("team/version-b", "s3://registry")

resolved, conflicts = resolve_package_conflicts(
    pkg1, pkg2, 
    resolution_strategy="rename_both"
)
print(f"Resolved {len(conflicts)} conflicts")
```

## 📋 Best Practices

### 1. **Logical Key Naming Conventions**

```python
# Good: Hierarchical, descriptive naming
pkg.set("data/raw/customers.csv", "./raw_customers.csv")
pkg.set("data/processed/customer_segments.csv", "./segments.csv")
pkg.set("models/classification/random_forest.pkl", "./rf_model.pkl")
pkg.set("docs/methodology.md", "./methodology.md")

# Bad: Flat, unclear naming
pkg.set("file1.csv", "./customers.csv")
pkg.set("data.csv", "./segments.csv")
pkg.set("model.pkl", "./rf_model.pkl")
```

### 2. **Metadata Standards**

```python
import quilt3
from datetime import datetime

def add_file_with_standard_metadata(pkg, logical_key, physical_path, 
                                   data_type, importance="medium"):
    """Add file with standardized metadata."""
    
    # Standard metadata schema
    file_metadata = {
        "data_type": data_type,
        "importance": importance,
        "added_at": datetime.utcnow().isoformat(),
        "file_format": Path(physical_path).suffix.lower(),
        "validation_status": "pending",
        "last_modified": datetime.fromtimestamp(
            Path(physical_path).stat().st_mtime
        ).isoformat()
    }
    
    pkg.set(logical_key, physical_path, meta=file_metadata)
    return pkg

# Example usage
pkg = quilt3.Package()
pkg = add_file_with_standard_metadata(
    pkg, "data/sales.csv", "./sales_data.csv", 
    data_type="transactional", importance="high"
)
```

### 3. **Version Control Integration**

```python
import quilt3
import subprocess

def create_versioned_package_from_git():
    """Create package with Git version information."""
    
    # Get Git information
    try:
        git_hash = subprocess.check_output(
            ['git', 'rev-parse', 'HEAD']
        ).decode('ascii').strip()
        
        git_branch = subprocess.check_output(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD']
        ).decode('ascii').strip()
        
        git_tag = subprocess.check_output(
            ['git', 'describe', '--tags', '--exact-match'], 
            stderr=subprocess.DEVNULL
        ).decode('ascii').strip()
    except:
        git_hash = git_branch = git_tag = "unknown"
    
    pkg = quilt3.Package()
    
    # Add Git metadata
    pkg.set_meta({
        "git_commit": git_hash,
        "git_branch": git_branch,
        "git_tag": git_tag,
        "reproducible": True,
        "created_from": "git_repository"
    })
    
    return pkg

# Example usage
pkg = create_versioned_package_from_git()
```

## 🔧 Troubleshooting

### Common Editing Issues

#### Issue 1: File Path Errors
```python
# Problem: File not found
try:
    pkg.set("data.csv", "./nonexistent.csv")
except FileNotFoundError as e:
    print(f"File not found: {e}")
    
    # Solution: Check file existence
    from pathlib import Path
    file_path = Path("./data.csv")
    if file_path.exists():
        pkg.set("data.csv", str(file_path))
    else:
        print(f"Please check file path: {file_path}")
```

#### Issue 2: Metadata Validation
```python
def validate_metadata(metadata):
    """Validate metadata structure."""
    required_fields = ["description", "author", "created_at"]
    
    for field in required_fields:
        if field not in metadata:
            raise ValueError(f"Missing required field: {field}")
    
    # Check data types
    if not isinstance(metadata.get("tags", []), list):
        raise ValueError("Tags must be a list")
    
    return True

# Example usage
try:
    metadata = {"description": "Test dataset", "author": "Data Team"}
    validate_metadata(metadata)
    pkg.set_meta(metadata)
except ValueError as e:
    print(f"Metadata validation failed: {e}")
```

#### Issue 3: Large Package Management
```python
def optimize_large_package(pkg, size_threshold_mb=100):
    """Optimize packages with large files."""
    
    large_files = []
    total_size = 0
    
    for key in pkg:
        try:
            file_size = pkg[key].size
            total_size += file_size
            
            if file_size > size_threshold_mb * 1024 * 1024:
                large_files.append((key, file_size))
        except:
            continue
    
    print(f"Package total size: {total_size / (1024**2):.2f} MB")
    print(f"Large files (>{size_threshold_mb}MB): {len(large_files)}")
    
    for key, size in large_files:
        print(f"  📄 {key}: {size / (1024**2):.2f} MB")
    
    # Recommendations
    if len(large_files) > 5:
        print("💡 Consider splitting large files or using external storage")
    
    return large_files

# Example usage
large_files = optimize_large_package(pkg, size_threshold_mb=50)
```

---

## 🎯 Next Steps

- **[Getting Data from Packages](getting-data-from-a-package.md)** - Learn to access and use package data
- **[Uploading Packages](uploading-a-package.md)** - Share your edited packages
- **[Working with Buckets](working-with-a-bucket.md)** - Direct S3 operations
- **[Advanced Features](../advanced-features/)** - Workflows, schemas, and automation

**Need help?** Join our [Slack community](https://quiltusers.slack.com/) or check the [troubleshooting guide](../Troubleshooting.md).


