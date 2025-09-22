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

### 1. Start MCP Servers

```bash
cd catalog/app/components/Assistant/MCP
docker-compose up -d
```

This will start:

- Package MCP Server on port 3001
- Visualization MCP Server on port 3002

### 2. Access the Demo

Navigate to `http://localhost:3000/mcp-demo` to test the MCP functionality.

### 3. Test MCP Tools

The demo page allows you to:

- View available MCP tools
- Test package search functionality
- Create new packages
- Update package metadata
- Generate visualizations

## MCP Servers

### Package Server (Port 3001)

Provides tools for:

- `quilt-package-search`: Search for packages
- `quilt-package-create`: Create new packages
- `quilt-metadata-update`: Update package metadata

### Visualization Server (Port 3002)

Provides tools for:

- `quilt-visualization-create`: Create data visualizations

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
# Start all MCP servers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop servers
docker-compose down

# Rebuild servers
docker-compose up --build -d
```

## API Endpoints

### MCP Server Endpoints

- `GET /tools` - List available tools
- `POST /execute` - Execute a tool
- `GET /health` - Health check

### Example Tool Execution

```javascript
// Search for packages
const response = await fetch('http://localhost:3001/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tool_id: 'quilt-package-search',
    args: { query: 'genomics', max_results: 10 },
  }),
})
```
