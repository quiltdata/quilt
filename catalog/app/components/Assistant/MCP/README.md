# MCP Authentication Integration

This document describes the implementation of JWT token enhancement for MCP (Model Context Protocol) server authentication in the Quilt frontend.

## Overview

The MCP integration enables seamless communication between the Quilt frontend and the MCP server by automatically enhancing JWT tokens with authorization claims. This allows the MCP server to authenticate users and determine their permissions for S3 bucket operations.

## Architecture

### Authentication Flow

1. **Token Retrieval**: The system automatically retrieves JWT tokens from Quilt's Redux store
2. **Role Extraction**: User roles are extracted from the Redux authentication state
3. **Permission Mapping**: Quilt roles are mapped to AWS S3 permissions using a predefined configuration
4. **Token Enhancement**: JWT tokens are enhanced with authorization claims
5. **MCP Communication**: Enhanced tokens are sent to the MCP server for authentication

### Key Components

#### 1. MCPContextProvider (`MCPContextProvider.tsx`)

The main React context provider that:

- Manages MCP client state
- Integrates with Quilt's authentication system
- Enhances JWT tokens with authorization claims
- Provides role information to the MCP client

**Key Functions:**

- `EnhancedTokenGenerator.generateEnhancedToken()`: Produces enhanced JWT tokens
- `getUserRolesFromState()`: Extracts user roles from Redux state
- `getUserPermissions()`: Maps roles to S3 permissions
- `getUserScope()`: Generates scope string from roles
- `getUserBuckets()`: Determines accessible buckets

#### 2. MCP Client (`Client.ts`)

The core MCP client that:

- Handles communication with the MCP server
- Manages authentication headers
- Implements token refresh logic
- Provides fallback authentication methods

**Key Features:**

- **Primary Authentication**: Redux Bearer Token (automatic)
- **Secondary Authentication**: OAuth Bearer Token (manual)
- **Fallback Authentication**: IAM Role Headers

#### 3. Role-to-Permission Mapping

Role and tool capabilities are defined in `catalog/app/services/mcpAuthorization.js`.
This shared module mirrors the backend BearerAuthService mappings, providing:

- Canonical Quilt role definitions and aliases
- Tool → AWS permission requirements for all MCP tools
- Authorization helpers for merging multiple roles and producing capability tags

The module can be extended to support new roles or tools while keeping the
frontend and MCP server in sync.

## JWT Token Enhancement

### Original Token Structure

```json
{
  "id": "8795f0cc-8deb-40dd-9132-13357c983984",
  "exp": 1766336063
}
```

### Enhanced Token Structure

```json
{
  "id": "8795f0cc-8deb-40dd-9132-13357c983984",
  "exp": 1766336063,
  "scope": "read write list delete",
  "permissions": ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:DeleteObject"],
  "roles": ["ReadWriteQuiltV2-sales-prod", "QuiltContributorRole"],
  "groups": ["quilt-users", "mcp-users"],
  "aud": "quilt-mcp-server",
  "iss": "quilt-frontend-enhanced",
  "buckets": ["quilt-sandbox-bucket", "nf-core-gallery"]
}
```

## Implementation Details

### Token Enhancement Process

1. **Decode Original Token**: Parse the JWT payload from the Redux store.
2. **Discover Buckets**: Query Quilt's GraphQL API for bucket metadata tied to
   the current user.
3. **Merge Role Authorizations**: Use `mergeAuthorizationForRoles` from
   `mcpAuthorization.js` to calculate scopes, permissions, and capabilities.
4. **Assemble Claims**: Combine original claims with dynamically discovered
   buckets, permissions, groups, and capability tags.
5. **Re-sign JWT**: Rebuild the token with an `HS256` signature using the
   configured front-end signing secret.

### Error Handling

The implementation includes comprehensive error handling:

- **Token Decoding Errors**: Graceful fallback to original token
- **Role Extraction Failures**: Log warnings and fall back to the original token
- **Permission Mapping Errors**: Log errors and continue with available permissions
- **Network Failures**: Automatic retry with exponential backoff

### Debugging and Logging

Extensive logging is provided for debugging:

- Token enhancement process
- Role extraction and mapping
- Permission generation
- Authentication method selection
- Error conditions and fallbacks

## Configuration

### Environment Variables

- `NODE_ENV`: Controls debug logging (development vs production)
- MCP server URL configuration
- Token refresh intervals
- `mcpEnhancedJwtSecret`: Shared HS256 signing secret exposed via catalog config
- `mcpEnhancedJwtKid`: Optional key identifier included in enhanced JWT headers

### Role Configuration

Role definitions live in `catalog/app/services/mcpAuthorization.js`. Update the
`ROLE_DEFINITIONS` and `TOOL_PERMISSION_MAP` constants there to introduce new
roles or extend tool coverage.

## Testing

### Unit Tests

The implementation includes comprehensive unit tests for:

- Token enhancement functionality
- Role-to-permission mapping
- Error handling scenarios
- Authentication flow validation

### Integration Tests

- End-to-end authentication flow
- MCP server communication
- Token refresh scenarios
- Permission validation

## Security Considerations

### Token Security

- **No Sensitive Data**: Enhanced tokens don't contain sensitive information
- **Permission-Based**: Only necessary permissions are included
- **Audience Validation**: Tokens are scoped to MCP server
- **Expiration Handling**: Automatic token refresh when expired

### Access Control

- **Role-Based**: Access is determined by user roles
- **Bucket-Scoped**: Users can only access authorized buckets
- **Permission-Granular**: Fine-grained S3 permissions
- **Fallback Security**: IAM role headers as secure fallback

## Troubleshooting

### Common Issues

1. **Token Enhancement Failures**

   - Check Redux state structure
   - Verify role extraction logic
   - Review permission mapping configuration

2. **Authentication Errors**

   - Verify MCP server configuration
   - Check token expiration
   - Review network connectivity

3. **Permission Denied**
   - Verify role-to-permission mapping
   - Check bucket access configuration
   - Review MCP server authorization logic

### Debug Logging

Enable debug logging by setting `NODE_ENV=development` to see:

- Token enhancement process
- Role extraction details
- Permission mapping results
- Authentication method selection

## Future Enhancements

### Planned Improvements

1. **Dynamic Role Loading**: Load roles from API instead of hardcoded configuration
2. **Permission Caching**: Cache permission mappings for better performance
3. **Audit Logging**: Track authentication and authorization events
4. **Token Validation**: Server-side token signature verification

### Extension Points

1. **Custom Role Mappings**: Support for custom role-to-permission mappings
2. **Multi-Tenant Support**: Support for multiple organizations
3. **Advanced Permissions**: Support for more granular S3 permissions
4. **Token Encryption**: Optional token payload encryption

## API Reference

### MCPContextProvider

#### `EnhancedTokenGenerator.generateEnhancedToken({ originalToken, roles, buckets })`

Generates an enhanced JWT containing dynamic authorization claims.

**Parameters:**

- `originalToken` (string): The original JWT token from Redux.
- `roles` (string[]): Roles discovered from the user's auth state.
- `buckets` (object[]): Bucket metadata discovered via GraphQL.

**Returns:**

- `Promise<string | null>`: Enhanced JWT token (or `null` if generation fails).

#### `getUserRolesFromState(state)`

Extracts user roles from Redux state.

**Parameters:**

- `state` (object): Redux state

**Returns:**

- `string[]`: Array of user role names

#### `getUserPermissions(roles)`

Maps user roles to S3 permissions.

**Parameters:**

- `roles` (string[]): Array of user role names

**Returns:**

- `string[]`: Array of S3 permissions

### MCP Client

#### `setReduxTokenGetter(getter)`

Sets the Redux token getter function.

**Parameters:**

- `getter` (function): Function that returns a Promise<string | null>

#### `getAuthenticationStatus()`

Returns current authentication status.

**Returns:**

- `Promise<object>`: Authentication status object

## Contributing

### Development Setup

1. Install dependencies: `npm install`
2. Start development server: `npm start`
3. Enable debug logging: Set `NODE_ENV=development`

### Code Style

- Use TypeScript for type safety
- Follow existing code patterns
- Add comprehensive error handling
- Include debug logging for troubleshooting

### Testing

- Write unit tests for new functionality
- Test error scenarios
- Verify integration with MCP server
- Test token refresh scenarios
