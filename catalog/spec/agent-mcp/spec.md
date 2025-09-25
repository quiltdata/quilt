# MCP Integration Specification for Quilt Catalog Agent

## Overview

This specification outlines the integration of Model Context Protocol (MCP) client capabilities into the Quilt Catalog as a proof-of-concept feature. The integration will provide a separate assistant interface that can connect to MCP servers to access external tools and resources.

## Goals

1. **Demonstrate MCP Integration**: Build a working MCP client within the Quilt Catalog browser environment
2. **Separate Interface**: Create a dedicated UI screen independent from the existing Qurator Assistant
3. **HTTP Transport**: Implement browser-compatible HTTP/REST transport for MCP communication
4. **Tool Extension**: Show how MCP can expand assistant capabilities through external tools

## Scope

### In Scope

- Separate assistant interface for MCP functionality
- HTTP/REST transport implementation
- Connection to public, no-authentication MCP servers
- Basic tool discovery and execution
- Integration with existing Bedrock LLM backend

### Out of Scope (for PoC)

- WebSocket or stdio transports
- Authentication and authorization
- Dynamic server discovery
- Resource management features
- Integration with main Qurator Assistant
- Performance optimizations

## Architecture Overview

### Component Structure

```
spec/agent-mcp/       # Specifications and documentation
app/components/Agent/ # New component tree for MCP assistant
├── Model/           # MCP client logic and tool handling
└── UI/              # Dedicated chat interface
```

### Key Design Decisions

1. **Separate Module**: MCP assistant will be a separate module from Qurator to avoid complexity and allow independent iteration

2. **HTTP-Only Transport**: Focus on HTTP/REST as it's browser-compatible and simpler to implement

3. **Hardcoded Servers**: Initial version will use a hardcoded list of trusted public MCP servers

4. **Tool Adaptation**: MCP tools will be adapted to work with the existing Effect.ts-based tool system

## User Experience

### Access Point

- New route: `/agent-mcp` or similar
- Separate navigation entry point
- Clear indication this is an experimental feature

### Interface

- Dedicated chat interface similar to Qurator
- Tool execution visibility
- Server connection status
- Clear error messaging

## Technical Approach

### MCP Client

- Browser-compatible HTTP client
- JSON-RPC or REST communication
- Async/await pattern for tool calls

### Tool Integration

- Adapter pattern to convert MCP tools to internal format
- Maintain compatibility with Bedrock tool calling
- Effect.ts integration for functional error handling

### Conversation Management

- Separate conversation state from main assistant
- Independent context management
- Own tool registry

## Test Strategy

### Test Server Requirements

- Public accessibility (no auth required)
- Stable and reliable
- Provides useful demonstration tools
- Safe for browser environments

### Candidate Servers

- To be identified based on MCP ecosystem availability
- Preference for official example servers
- Simple tools like math, time, or echo services

## Success Criteria

1. Successfully connect to at least one public MCP server
2. Discover and execute tools from the MCP server
3. Complete end-to-end conversation with tool usage
4. Clear separation from existing Qurator functionality
5. Demonstrate value of MCP integration

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
