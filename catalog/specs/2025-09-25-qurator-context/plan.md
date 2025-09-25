# Implementation Plan: Enhanced Qurator Context System

## Overview

Enhance existing context managers to load context files (README.md) from the directory hierarchy, providing better context to the assistant about the current location and domain.

## Implementation Approach

### 1. Bucket Root Context

**New File: `app/containers/Bucket/AssistantContext.tsx`**
- Load context file from bucket root
- Active whenever browsing inside a bucket
- Add marker: `bucketContextFilesReady`

```typescript
export const BucketContext = Assistant.Context.LazyContext(
  ({ bucket, s3 }) => {
    // Load context file from bucket root
    // Return as context message with marker
  }
)
```

### 2. Directory Context Enhancement

**Modify: `app/containers/Bucket/DirAssistantContext.ts`**
- Load context file hierarchy from current dir up to (excluding) bucket root
- Add to existing listing context
- Add marker: `dirContextFilesReady`

```typescript
// Add to existing ListingContext:
// - Build path chain from current to parent directories
// - Load context files from each level
// - Format as XML with path information
// - Most specific (current) first in hierarchy
```

### 3. File Context Enhancement

**Modify: `app/containers/Bucket/File/AssistantContext.ts`**
- Load context file hierarchy from file's parent directory up
- Add alongside existing version context
- Add marker: `fileContextFilesReady`

```typescript
// Add new context provider:
export const FileContextFiles = Assistant.Context.LazyContext(
  ({ bucket, path, s3 }) => {
    // Get parent directory of file
    // Load context file chain from parent up to root
  }
)
```

### 4. Package Root Context

**New File: `app/containers/Bucket/PackageTree/AssistantContext.tsx`**
- Load package metadata (name, hash, manifest info)
- Load context file from package root
- Add markers: `packageMetadataReady`, `packageContextFilesReady`

```typescript
export const PackageRootContext = Assistant.Context.LazyContext(
  ({ bucket, name, hash, manifest, s3 }) => {
    // Format package metadata
    // Load context file from package root
    // Return both as context messages
  }
)
```

### 5. Package Directory Context

**Modify: `app/containers/Bucket/PackageTree/PackageTree.tsx`**
- For directories within packages: load context file hierarchy
- Walk from current location up to package root
- Then from package as child of bucket up to bucket root
- Add marker: `packageDirContextFilesReady`

## Context File Loading Implementation

**New File: `app/components/Assistant/Model/ContextFiles.ts`**

```typescript
interface ContextFileContent {
  path: string
  content: string
  truncated: boolean
}

const MAX_CONTEXT_FILE_SIZE = 100_000 // 100KB default
const CONTEXT_FILE_NAME = 'README.md'

async function loadContextFile(s3, bucket, path): Promise<ContextFileContent | null> {
  // Try to load context file at path
  // Handle 404 gracefully (return null)
  // Truncate if larger than MAX_CONTEXT_FILE_SIZE
  // Return content with metadata
}

async function loadContextFileHierarchy(s3, bucket, currentPath, stopAt?: string): Promise<ContextFileContent[]> {
  // Build path chain from current to root (or stopAt)
  // Load context files in parallel
  // Filter out nulls (missing context files)
  // Return ordered by specificity
}

function buildPathChain(currentPath: string, stopAt?: string): string[] {
  // Split path into segments
  // Build array of paths from current up to root
  // Stop at stopAt if provided (for excluding bucket root)
  // Example: 'a/b/c' → ['a/b/c', 'a/b', 'a']
}

function buildPackagePathChain(packagePath: string, packageRoot: string): string[] {
  // Build chain within package first
  // Then add package as child of bucket
  // Don't include bucket root (handled separately)
}
```

## Integration Points

### Directory View
```typescript
// In Dir.tsx or DirAssistantContext.ts
const contextFiles = useContextFileHierarchy(bucket, path, s3)
// Push to context with listing data
```

### File View
```typescript
// In File.js or AssistantContext.ts
const parentPath = path.substring(0, path.lastIndexOf('/'))
const contextFiles = useContextFileHierarchy(bucket, parentPath, s3)
// Include with version context
```

### Package Views
```typescript
// In PackageTree.tsx
// Determine if at package root or subdirectory
// Load appropriate context (root metadata or dir hierarchy)
const contextFiles = usePackageContextFileHierarchy(bucket, packageName, packagePath, s3)
```

## Error Handling

- **Missing context files**: Expected, handle gracefully (no error)
- **Large files**: Truncate and mark as truncated
- **Network errors**: Log but don't break context loading
- **Timeouts**: Skip that context file, continue with others

## Context Message Format

```xml
<!-- Bucket context file -->
<context-file
  path="/data/experiments/README.md"
  truncated="false"
  scope="bucket"
  bucket="my-bucket">
# Experiments Data

This directory contains experimental results...
</context-file>

<!-- Package context file -->
<context-file
  path="/analysis/README.md"
  truncated="true"
  scope="package"
  bucket="my-bucket"
  package-name="my-package">
# Analysis Directory

[Content truncated at 100000B]
</context-file>
```

### Attributes:
- `path`: File path within its scope
- `truncated`: Whether content was truncated
- `scope`: Either "bucket" or "package"
- `bucket`: The bucket name
- `package-name`: (Package scope only) The package name

## Markers Summary

- `bucketContextFilesReady`: Bucket root context file loaded
- `dirContextFilesReady`: Directory hierarchy context files loaded
- `fileContextFilesReady`: File parent hierarchy context files loaded
- `packageMetadataReady`: Package metadata loaded
- `packageContextFilesReady`: Package root context file loaded
- `packageDirContextFilesReady`: Package directory hierarchy loaded
