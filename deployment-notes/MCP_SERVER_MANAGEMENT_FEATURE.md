# MCP Server Management Feature

## Overview
This feature adds comprehensive MCP (Model Context Protocol) server management capabilities to the Quilt catalog frontend, allowing users to view, configure, and manage multiple MCP servers directly from the chat interface.

## Key Features

### 1. **MCP Server Selector**
- **Location**: Embedded in the chat input helper text area
- **Functionality**:
  - Displays current MCP server status with color-coded indicator
    - 🟢 Green: Connected
    - 🟠 Orange: Loading
    - 🔴 Red: Disconnected
  - Shows tool count for each server
  - Expandable dropdown to view all available tools
  - Easy switching between configured servers

### 2. **Circular Up Arrow Send Button**
- Replaced the airplane "send" icon with "arrow_circle_up" icon
- More intuitive for message submission
- Maintains all existing functionality

### 3. **MCP Server Configuration Dialog**
- **Access**: Click "+ Configure Additional Servers" in the server selector dropdown
- **Supported MCP Servers**:
  1. **Benchling MCP** 🧬
     - Access Benchling notebook entries, DNA sequences, and lab data
     - Requires API key authentication
  2. **PubMed MCP** 📚
     - Search and retrieve scientific literature from PubMed/NCBI
     - No authentication required
  3. **CellxGene MCP** 🧫
     - Access single-cell genomics data from CellxGene
     - No authentication required
  4. **Nextflow MCP** ⚗️
     - Manage and execute Nextflow bioinformatics workflows
     - Requires API key authentication

### 4. **Server Configuration**
- Custom server naming
- Endpoint URL configuration
- API key management (encrypted local storage)
- Connection testing before saving
- Documentation links for setup

## Technical Implementation

### New Components

#### 1. MCPServerSelector (`MCPServerSelector.tsx`)
```typescript
interface MCPServer {
  id: string
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'loading'
  endpoint?: string
  toolCount?: number
  tools?: Array<{
    name: string
    description: string
  }>
}
```

**Features**:
- Real-time server status monitoring
- Tool count display
- Expandable tool list with descriptions
- Server switching capability
- Integration with localStorage for persistence

#### 2. MCPServerConfig (`MCPServerConfig.tsx`)
```typescript
interface MCPServerTemplate {
  id: string
  name: string
  description: string
  icon?: string
  defaultEndpoint?: string
  requiresAuth: boolean
  authType?: 'api-key' | 'oauth' | 'none'
  documentationUrl?: string
}
```

**Features**:
- Template-based server configuration
- API key input with password field
- Connection testing
- Validation before save
- Help documentation links

#### 3. Updated Chat Input (`Input.tsx`)
- Integrated MCP server selector in helper text
- Changed send icon to circular up arrow
- Added configuration dialog state management
- Server configuration persistence

### Data Storage

#### LocalStorage Schema
```json
{
  "mcp-additional-servers": [
    {
      "id": "benchling",
      "name": "Benchling MCP",
      "endpoint": "https://api.benchling.com/mcp",
      "apiKey": "encrypted_api_key",
      "enabled": true
    }
  ]
}
```

### Server Status Monitoring

The system automatically monitors server status through:
1. Initial connection attempt on load
2. `listAvailableTools()` call to verify connectivity
3. Status updates based on response
4. Periodic refresh when selector is opened

## User Workflow

### Viewing MCP Servers
1. Look at the chat input area
2. In the helper text, you'll see the current MCP server status
3. Click on the server button to see dropdown

### Configuring a New Server
1. Click "Configure Additional Servers" in dropdown
2. Select a server template (e.g., Benchling, PubMed)
3. Enter server name (or use default)
4. Enter endpoint URL
5. If required, enter API key
6. Click "Test Connection" to verify
7. Click "Save Server" to add

### Switching Servers
1. Open the MCP server dropdown
2. Click on any configured server
3. The system will attempt to connect
4. Status indicator will update based on connection

### Viewing Available Tools
1. Open the MCP server dropdown
2. Click the expand arrow (▾) next to a server
3. View all available tools with descriptions
4. Tools are automatically refreshed on connection

## Deployment Information

### Version
- **Stack Version**: `1.64.1a23-mcp-servers`
- **Docker Image**: `850787717197.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog:mcp-servers-v1`
- **ECS Task Definition**: `sales-prod-nginx_catalog:115`

### Build Process
```bash
# Build frontend
cd catalog
npm run build

# Build Docker image for AMD64
docker build --platform linux/amd64 -t quiltdata/catalog:mcp-servers-v1 .

# Tag and push to ECR
docker tag quiltdata/catalog:mcp-servers-v1 850787717197.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog:mcp-servers-v1
docker push 850787717197.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog:mcp-servers-v1

# Deploy to ECS
aws ecs register-task-definition --cli-input-json file://updated-task-definition-auth-refactor.json
aws ecs update-service --cluster sales-prod --service sales-prod-nginx_catalog --task-definition sales-prod-nginx_catalog:115
```

## UI/UX Improvements

### Visual Indicators
- **Status Lights**: Color-coded connection status (green/orange/red)
- **Tool Count Badges**: Quick view of available tools per server
- **Expandable Lists**: Detailed tool information on demand
- **Icons**: Distinctive icons for each MCP server type

### Accessibility
- Tooltip on server selector button
- Clear labeling for all form fields
- Connection test feedback
- Error messages with helpful context

### Responsiveness
- Dropdown width: 350px
- Max height: 400px with scroll
- Adapts to available space
- Works on all screen sizes

## Future Enhancements

### Potential Additions
1. **OAuth Support**: For servers requiring OAuth authentication
2. **Server Health Monitoring**: Background status checks
3. **Tool Favorites**: Mark frequently used tools
4. **Server Groups**: Organize servers by category
5. **Import/Export Config**: Share server configurations
6. **Usage Analytics**: Track tool usage across servers
7. **Custom MCP Servers**: Add any MCP-compatible server
8. **Connection Retry Logic**: Automatic reconnection attempts

### Integration Opportunities
1. **Benchling Integration**: Direct lab data access
2. **PubMed Search**: Literature review within Qurator
3. **CellxGene Data**: Single-cell analysis workflows
4. **Nextflow Pipelines**: Bioinformatics workflow execution

## Security Considerations

### API Key Storage
- Stored in browser localStorage (not ideal for production)
- **Recommendation**: Migrate to secure backend storage
- Consider using browser credential management API
- Implement key rotation policies

### Server Validation
- Connection testing before configuration
- HTTPS-only endpoints recommended
- CORS configuration required on MCP servers
- Rate limiting to prevent abuse

### Best Practices
1. Never commit API keys to version control
2. Use environment variables for sensitive data
3. Implement proper authentication on MCP servers
4. Regular security audits of MCP endpoints
5. Monitor for unusual API usage patterns

## Testing

### Manual Testing Checklist
- [ ] Server selector displays correctly
- [ ] Status indicators update properly
- [ ] Tool list expands/collapses
- [ ] Configuration dialog opens
- [ ] Server templates load
- [ ] Connection test works
- [ ] Server saves to localStorage
- [ ] Saved servers persist on reload
- [ ] Server switching works
- [ ] Send button shows circular up arrow
- [ ] All UI elements are responsive

### Browser Compatibility
- Chrome/Edge: ✅ Tested
- Firefox: ⚠️ Needs testing
- Safari: ⚠️ Needs testing
- Mobile browsers: ⚠️ Needs testing

## Troubleshooting

### Common Issues

#### Server Shows as Disconnected
- Check endpoint URL is correct
- Verify server is running
- Check CORS configuration
- Verify API key if required

#### Tools Not Loading
- Check MCP server implements `tools/list` method
- Verify network connectivity
- Check browser console for errors
- Try refreshing the connection

#### Configuration Not Saving
- Check localStorage is enabled
- Verify no browser extensions blocking storage
- Check for JavaScript errors
- Try clearing cache

## Documentation Links

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Benchling API Documentation](https://docs.benchling.com/api)
- [PubMed E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/)
- [CellxGene Data Portal](https://cellxgene.cziscience.com/)
- [Nextflow Documentation](https://www.nextflow.io/docs/latest/)

## Support

For issues or questions:
1. Check browser console for errors
2. Verify MCP server configuration
3. Test connection using provided test button
4. Contact Quilt support with specific error messages

---

**Deployed**: October 2, 2025  
**Version**: 1.64.1a23-mcp-servers  
**Status**: ✅ Active in Production

