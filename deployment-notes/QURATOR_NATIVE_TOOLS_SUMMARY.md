# Qurator Native Tools Summary

This document provides a comprehensive overview of the native tools and functions available within Qurator that are built into the system (apart from MCP tools).

## Core Native Tools

### 1. **Navigation Tool** (`navigate`)
**Purpose:** Navigate to different pages and routes within the Quilt catalog

**Schema:**
```typescript
{
  route: {
    name: string,        // Route name (e.g., 'home', 'bucket.overview')
    params?: object      // Route parameters
  }
}
```

**Available Routes:**

#### **Global Routes:**
- `home` - Home page (`/`)
- `install` - Installation page (`/install`)
- `activate` - Account activation (`/activate/{token}`)
- `search` - Global search page (`/search`)

#### **Bucket Routes:**
- `bucket.overview` - Bucket overview page (`/b/{bucket}`)
- `bucket.object` - S3 Object/File page (`/b/{bucket}/files/{path}`)
- `bucket.prefix` - S3 Prefix/Directory page (`/b/{bucket}/files/{path}/`)

**Parameters:**
- **bucket.overview:** `{ bucket: string }`
- **bucket.object:** `{ bucket: string, path: string, version?: string, mode?: string }`
- **bucket.prefix:** `{ bucket: string, path: string }`

**Example Usage:**
```javascript
// Navigate to home page
navigate({ route: { name: 'home' } })

// Navigate to bucket overview
navigate({ route: { name: 'bucket.overview', params: { bucket: 'quilt-sales-raw' } } })

// Navigate to specific file
navigate({ 
  route: { 
    name: 'bucket.object', 
    params: { 
      bucket: 'quilt-sales-raw', 
      path: 'data/experiment.csv',
      version: 'abc123',
      mode: 'preview'
    } 
  } 
})

// Navigate to directory
navigate({ 
  route: { 
    name: 'bucket.prefix', 
    params: { 
      bucket: 'quilt-sales-raw', 
      path: 'data/' 
    } 
  } 
})
```

### 2. **Object Retrieval Tool** (`catalog_global_getObject`)
**Purpose:** Get contents and metadata of S3 objects

**Schema:**
```typescript
{
  bucket: string,        // S3 bucket name
  key: string,          // S3 object key (file path)
  version?: string      // Object version ID (optional)
}
```

**Capabilities:**
- Retrieves object metadata (size, last modified, content type, etc.)
- Downloads and processes object content
- Supports different content types:
  - **Text files** - Plain text, JSON, CSV, etc.
  - **Images** - JPEG, PNG, GIF, etc.
  - **Documents** - PDF, Word, etc.
  - **Data files** - Parquet, HDF5, etc.

**Content Processing:**
- **Text files:** Returns raw text content
- **JSON files:** Parsed and formatted JSON
- **Images:** Base64 encoded with metadata
- **Large files:** Metadata only (size > 500KB)
- **Binary files:** Metadata and download link

**Example Usage:**
```javascript
// Get a CSV file
catalog_global_getObject({
  bucket: 'quilt-sales-raw',
  key: 'data/experiment.csv'
})

// Get specific version of a file
catalog_global_getObject({
  bucket: 'quilt-sales-raw',
  key: 'data/experiment.csv',
  version: 'abc123def456'
})

// Get a JSON configuration file
catalog_global_getObject({
  bucket: 'quilt-sales-raw',
  key: 'config/experiment.json'
})
```

## Context Information

### 3. **Stack Information** (Automatic Context)
**Purpose:** Provides information about available buckets and their metadata

**Content:**
- List of all accessible buckets
- Bucket metadata (name, title, description, tags)
- Bucket relevance scores
- Last indexed timestamps

**Format:**
```xml
<quilt-stack-info>
  <buckets>
    Buckets attached to this stack:
    <bucket>
      {
        "name": "quilt-sales-raw",
        "title": "Sales Raw Data",
        "description": "Raw sales data and experiments",
        "tags": ["sales", "raw", "experiments"]
      }
    </bucket>
    <!-- More buckets... -->
  </buckets>
</quilt-stack-info>
```

### 4. **Route Context** (Automatic Context)
**Purpose:** Provides information about the current page/route

**Content:**
- Current route information
- Route parameters
- Available navigation options
- Page-specific context

## Tool Integration

### **How Native Tools Work:**
1. **Built into Qurator** - These tools are part of the core Qurator system
2. **Always Available** - No MCP server required
3. **Direct Access** - Tools interact directly with Quilt's frontend and backend
4. **Context Aware** - Tools have access to current user session and permissions

### **Tool Execution Flow:**
1. User requests navigation or object retrieval
2. Tool validates parameters and permissions
3. Tool executes the requested action
4. Tool returns success/failure with appropriate content
5. UI updates based on tool results

## Available Buckets (Context)

The system has access to 30+ production buckets including:
- `cellpainting-gallery` - Cell painting data
- `cellxgene-*` - Single-cell genomics data  
- `gdc-ccle-2-open` - Cancer cell line data
- `nf-core-gallery` - Nextflow workflows
- `omics-quilt-*` - Omics processing data
- `pmc-oa-opendata` - Open access publications
- `quilt-*` - Various Quilt datasets
- `sra-pub-run-odp` - SRA public data
- And many more...

## Usage Examples

### **Navigation Examples:**
```javascript
// Navigate to home
navigate({ route: { name: 'home' } })

// Browse a specific bucket
navigate({ 
  route: { 
    name: 'bucket.overview', 
    params: { bucket: 'quilt-sales-raw' } 
  } 
})

// View a specific file
navigate({ 
  route: { 
    name: 'bucket.object', 
    params: { 
      bucket: 'quilt-sales-raw', 
      path: 'data/experiment.csv' 
    } 
  } 
})

// Browse a directory
navigate({ 
  route: { 
    name: 'bucket.prefix', 
    params: { 
      bucket: 'quilt-sales-raw', 
      path: 'data/' 
    } 
  } 
})
```

### **Object Retrieval Examples:**
```javascript
// Get a data file
catalog_global_getObject({
  bucket: 'quilt-sales-raw',
  key: 'data/experiment.csv'
})

// Get a configuration file
catalog_global_getObject({
  bucket: 'quilt-sales-raw',
  key: 'config/settings.json'
})

// Get a specific version
catalog_global_getObject({
  bucket: 'quilt-sales-raw',
  key: 'data/experiment.csv',
  version: 'abc123def456'
})
```

## Integration with MCP

### **Complementary Functionality:**
- **Native tools** handle navigation and basic object retrieval
- **MCP tools** handle complex data operations, search, and analysis
- **Combined workflow:** Navigate to data → Retrieve objects → Analyze with MCP tools

### **Tool Coordination:**
1. Use `navigate` to browse to relevant buckets/files
2. Use `catalog_global_getObject` to retrieve specific files
3. Use MCP tools for complex operations (search, analysis, package creation)
4. Use `navigate` to move between different views

## Security and Permissions

### **Access Control:**
- All native tools respect user permissions
- Navigation is limited to accessible buckets
- Object retrieval requires appropriate S3 permissions
- Tools automatically handle authentication via JWT tokens

### **Error Handling:**
- Invalid routes return navigation errors
- Permission denied returns appropriate error messages
- Large files return metadata only to prevent timeouts
- Network errors are handled gracefully

## Performance Considerations

### **Optimizations:**
- Object retrieval has size limits (500KB threshold)
- Large files return metadata only
- Navigation includes loading states and markers
- Context information is cached and updated efficiently

### **Limitations:**
- Object retrieval limited to single files
- No batch operations for multiple objects
- Navigation requires page loads (not instant)
- Large file content not retrieved by default

## Summary

Qurator's native tools provide essential navigation and basic data access capabilities:

1. **`navigate`** - Navigate between pages and routes
2. **`catalog_global_getObject`** - Retrieve S3 object contents and metadata
3. **Stack Information** - Context about available buckets
4. **Route Context** - Information about current page

These tools work seamlessly with MCP tools to provide a complete data exploration and analysis experience within the Quilt catalog.
