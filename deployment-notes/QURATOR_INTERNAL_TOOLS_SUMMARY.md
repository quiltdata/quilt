# Qurator Internal Tools and Services Summary

This document provides a comprehensive overview of the tools and services available within Qurator (apart from MCP) that the MCP server can interact with to provide enhanced functionality.

## Core Quilt Services

### 1. **GraphQL API** (`/graphql`)
The primary API for all Quilt operations, providing:

#### **Query Operations:**
- `me` - Current user information
- `config` - System configuration
- `bucketConfigs` - Available bucket configurations
- `bucketConfig(name)` - Specific bucket configuration
- `packages` - Package listings with pagination
- `package(bucket, name)` - Specific package details
- `searchObjects(buckets, searchString)` - Object search
- `searchPackages(buckets, searchString, latestOnly)` - Package search
- `searchMoreObjects` - Paginated object search
- `searchMorePackages` - Paginated package search
- `subscription` - Subscription state
- `bucketAccessCounts` - Bucket access analytics
- `objectAccessCounts` - Object access analytics
- `admin` - Administrative queries
- `policies` - Access policies
- `roles` - User roles
- `status` - System status

#### **Package Operations:**
- Package metadata and revisions
- Package contents and file trees
- Package access counts and analytics
- Package user metadata and facets

### 2. **REST API** (`/api`)
Legacy REST endpoints for:
- File operations
- Package management
- User management
- System configuration

### 3. **S3 Proxy** (`/s3-proxy`)
Direct S3 access through Quilt's proxy service for:
- Object retrieval
- File downloads
- Metadata access

## Data Access Tools

### **S3 Bucket Operations**
- `bucket_objects_list` - List objects in bucket
- `bucket_object_info` - Get object metadata
- `bucket_object_text` - Read text files
- `bucket_object_fetch` - Download objects
- `bucket_objects_put` - Upload objects
- `bucket_object_link` - Generate access links

### **Package Management**
- `package_create` - Create new packages
- `package_update` - Update existing packages
- `package_delete` - Delete packages
- `package_browse` - Browse package contents
- `package_contents_search` - Search within packages
- `package_diff` - Compare package versions
- `create_package_enhanced` - Enhanced package creation
- `create_package_from_s3` - Create packages from S3
- `package_create_from_s3` - Alternative S3 package creation

### **Search and Discovery**
- `unified_search` - Cross-platform search
- `packages_search` - Package-specific search
- `bucket_access_check` - Check bucket permissions
- `bucket_recommendations_get` - Get bucket recommendations
- `aws_permissions_discover` - Discover AWS permissions

## Analytics and Query Tools

### **Amazon Athena Integration**
- `athena_query_execute` - Execute SQL queries
- `athena_databases_list` - List available databases
- `athena_tables_list` - List tables in databases
- `athena_table_schema` - Get table schemas
- `athena_workgroups_list` - List workgroups
- `athena_query_history` - Query execution history

### **AWS Glue Integration**
- `tabulator_tables_list` - List Glue tables
- `tabulator_table_create` - Create Glue tables

## Authentication and Authorization

### **JWT Token System**
- Enhanced JWT tokens with compression
- Role-based access control (RBAC)
- Bucket-level permissions
- Tool-level permissions

### **Authorization Levels**
- `READ` - Read-only access
- `WRITE` - Read/write access
- `ADMIN` - Full administrative access

### **Role Definitions**
- `ReadWriteQuiltV2-sales-prod` - Full access to production buckets
- `ReadOnlyQuilt` - Read-only access to sandbox
- `AdminQuilt` - Full administrative access

## Available Buckets (Production)

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

## Configuration and Discovery

### **Dynamic Bucket Discovery**
- Real-time bucket configuration fetching
- Bucket metadata and descriptions
- Relevance scoring
- Last indexed timestamps

### **System Configuration**
- Region settings
- API endpoints
- Authentication methods
- Feature flags (Qurator, MCP, etc.)

## MCP Integration Points

### **Available MCP Tools**
The MCP server can leverage these internal tools:

1. **Data Access Tools**
   - Package search and browsing
   - Object retrieval and analysis
   - Bucket exploration

2. **Analytics Tools**
   - Athena query execution
   - Data visualization
   - Access pattern analysis

3. **Management Tools**
   - Package creation and updates
   - Permission checking
   - User role management

### **Authentication Flow**
1. MCP server receives JWT token from frontend
2. Token contains user roles and bucket permissions
3. Server validates permissions against tool requirements
4. Operations are executed with appropriate AWS credentials

### **Permission Mapping**
Each tool has specific AWS permission requirements:
- S3 operations: `s3:ListBucket`, `s3:GetObject`, etc.
- Athena operations: `athena:StartQueryExecution`, etc.
- Glue operations: `glue:GetDatabases`, etc.

## API Endpoints

### **Primary Endpoints**
- `{registryUrl}/graphql` - GraphQL API
- `{registryUrl}/api` - REST API
- `{s3Proxy}` - S3 proxy service
- `{mcpEndpoint}` - MCP server endpoint

### **Authentication Headers**
- `Authorization: Bearer {jwt_token}` - JWT authentication
- `X-MCP-Debug: true` - Debug logging (optional)

## Usage Examples

### **Package Search**
```graphql
query {
  searchPackages(buckets: ["quilt-sales-raw"], searchString: "cancer") {
    ... on PackagesSearchResultSet {
      total
      packages {
        name
        hash
        metadata
      }
    }
  }
}
```

### **Bucket Object Listing**
```javascript
// Via MCP tool
{
  "name": "bucket_objects_list",
  "arguments": {
    "bucket": "quilt-sales-raw",
    "prefix": "data/",
    "max_keys": 100
  }
}
```

### **Athena Query Execution**
```javascript
// Via MCP tool
{
  "name": "athena_query_execute",
  "arguments": {
    "query": "SELECT * FROM table LIMIT 10",
    "workgroup": "primary",
    "database": "default"
  }
}
```

## Security Considerations

1. **JWT Token Validation** - All requests must include valid JWT tokens
2. **Role-Based Access** - Users can only access tools they're authorized for
3. **Bucket Permissions** - Access is limited to authorized buckets
4. **AWS IAM Integration** - Operations use appropriate AWS credentials
5. **Audit Logging** - All operations are logged for compliance

## Integration Guidelines

When implementing MCP tools that interact with these services:

1. **Always validate JWT tokens** before making requests
2. **Check user permissions** against required AWS permissions
3. **Use appropriate error handling** for permission denials
4. **Implement rate limiting** for expensive operations
5. **Log all operations** for debugging and compliance
6. **Respect bucket access controls** and user roles

This comprehensive toolset enables the MCP server to provide rich data access, analysis, and management capabilities while maintaining security and compliance with organizational policies.
