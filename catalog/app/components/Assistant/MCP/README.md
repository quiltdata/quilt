# MCP (Model Context Protocol) Implementation for Quilt

This directory contains the MCP Client implementation for Quilt, enabling AI-powered data management through Docker-based MCP servers.

## Overview

The MCP implementation provides:

- **Package Search**: Find packages in the Quilt registry
- **Package Creation**: Create new packages with files and metadata
- **Metadata Updates**: Update existing package metadata
- **Visualization Creation**: Generate data visualizations using Vega, ECharts, or Perspective

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Quilt UI      │    │   MCP Client     │    │   MCP Servers       │
│                 │    │                  │    │                     │
│ - Qurator       │◄──►│ - Tool Discovery │◄──►│ - Package Server    │
│ - MCP Demo      │    │ - Tool Execution │    │ - Visualization     │
│                 │    │ - Bedrock Int.   │    │   Server            │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

## Quick Start

### 1. Configure MCP Endpoint

The MCP client can connect to different types of endpoints:

- **Streamable HTTP Endpoint** (Recommended): `http://localhost:8000/mcp?transport=streamable-http`
- **SSE Endpoint**: `http://localhost:8000/sse`
- **HTTP Endpoint**: `http://localhost:8000/mcp`
- **Remote Endpoint**: `https://your-mcp-server.com/mcp?transport=streamable-http`

Update your configuration in `static-dev/config.js`:

```javascript
window.QUILT_CATALOG_CONFIG = {
  // ... other config
  mcpEndpoint: 'http://localhost:8000/mcp?transport=streamable-http', // Streamable HTTP endpoint
}
```

### 2. Start MCP Server

The MCP client now connects to the `quilt-mcp-server` which supports multiple transport modes:

```bash
# Start quilt-mcp-server with streamable-http transport (recommended)
docker run -d \
  --name quilt-mcp-server \
  -p 8000:8000 \
  -e FASTMCP_TRANSPORT=streamable-http \
  -e FASTMCP_HOST=0.0.0.0 \
  -e FASTMCP_PORT=8000 \
  quilt-mcp:latest

# Or with SSE transport
docker run -d \
  --name quilt-mcp-server \
  -p 8000:8000 \
  -e FASTMCP_TRANSPORT=sse \
  -e FASTMCP_HOST=0.0.0.0 \
  -e FASTMCP_PORT=8000 \
  quilt-mcp:latest
```

### 3. Access the Demo

Navigate to `http://localhost:3000/mcp-demo` to test the MCP functionality.

### 4. Test MCP Tools

The demo page allows you to:

- View available MCP tools (84+ tools available)
- Test package search functionality
- Create new packages with metadata templates
- Update package metadata
- Browse S3 buckets and objects
- Execute SQL queries with Athena
- Manage workflows and permissions

## MCP Server Architecture

The client now connects to the `quilt-mcp-server` which provides:

### Core Tools (84+ available)

- **Authentication**: `auth_status`, `catalog_info`, `filesystem_status`
- **Package Management**: `create_package_enhanced`, `package_browse`, `packages_search`
- **S3 Operations**: `bucket_objects_list`, `bucket_object_info`, `unified_search`
- **Analytics**: `athena_query_execute`, `tabulator_tables_list`
- **Workflows**: `workflow_create`, `workflow_add_step`, `workflow_get_status`
- **Metadata**: `get_metadata_template`, `validate_metadata_structure`
- **Administration**: `admin_users_list`, `admin_user_create`, `admin_roles_list`

### Transport Modes

- **SSE (Server-Sent Events)**: Recommended for real-time communication
- **HTTP**: Standard HTTP requests/responses
- **Streamable HTTP**: For large data transfers

## Integration with Bedrock

The MCP Client integrates with Amazon Bedrock models to enable AI-powered tool execution. Configure your AWS credentials and model preferences in the Bedrock integration.

## Development

### Adding New Tools

1. Define the tool interface in `types.ts`
2. Implement the tool logic in `tools/`
3. Add the tool to the MCP server
4. Update the Bedrock integration if needed

### Testing

Use the MCP Demo page at `/mcp-demo` to test functionality locally.

## Docker Commands

```bash
# Start quilt-mcp-server with streamable-http transport (recommended)
docker run -d \
  --name quilt-mcp-server \
  -p 8000:8000 \
  -e FASTMCP_TRANSPORT=streamable-http \
  -e FASTMCP_HOST=0.0.0.0 \
  -e FASTMCP_PORT=8000 \
  -e QUILT_CATALOG_DOMAIN=your-catalog.quiltdata.com \
  -e QUILT_DEFAULT_BUCKET=your-bucket \
  quilt-mcp:latest

# View logs
docker logs -f quilt-mcp-server

# Stop server
docker stop quilt-mcp-server

# Remove container
docker rm quilt-mcp-server

# For SSE transport
docker run -d \
  --name quilt-mcp-server \
  -p 8000:8000 \
  -e FASTMCP_TRANSPORT=sse \
  -e FASTMCP_HOST=0.0.0.0 \
  -e FASTMCP_PORT=8000 \
  quilt-mcp:latest

# For standard HTTP transport
docker run -d \
  --name quilt-mcp-server \
  -p 8000:8000 \
  -e FASTMCP_TRANSPORT=http \
  -e FASTMCP_HOST=0.0.0.0 \
  -e FASTMCP_PORT=8000 \
  quilt-mcp:latest
```

## API Endpoints

### MCP Protocol Endpoints

The client uses the standard MCP (Model Context Protocol) endpoints:

- `POST /sse` - SSE endpoint for real-time communication
- `POST /mcp` - HTTP endpoint for standard requests
- `GET /healthz` - Health check endpoint

### Example Tool Execution

```javascript
// Initialize MCP session
const initResponse = await fetch('http://localhost:8000/sse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 'init-session',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {}, prompts: {}, resources: {} },
      clientInfo: { name: 'quilt-catalog', version: '1.0.0' },
    },
  }),
})

// List available tools
const toolsResponse = await fetch('http://localhost:8000/sse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 'list-tools',
    method: 'tools/list',
    params: {},
  }),
})

// Execute a tool
const toolResponse = await fetch('http://localhost:8000/sse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 'call-packages_search',
    method: 'tools/call',
    params: {
      name: 'packages_search',
      arguments: { query: 'genomics', limit: 10 },
    },
  }),
})
```

### Configuration Examples

```javascript
// Streamable HTTP endpoint (recommended)
"mcpEndpoint": "http://localhost:8000/mcp?transport=streamable-http"

// SSE endpoint
"mcpEndpoint": "http://localhost:8000/sse"

// Standard HTTP endpoint
"mcpEndpoint": "http://localhost:8000/mcp"

// Remote streamable HTTP endpoint
"mcpEndpoint": "https://your-mcp-server.com/mcp?transport=streamable-http"

// Remote SSE endpoint
"mcpEndpoint": "https://your-mcp-server.com/sse"
```
