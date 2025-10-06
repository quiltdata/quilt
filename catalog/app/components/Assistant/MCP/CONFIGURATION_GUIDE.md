# Dynamic Authentication Configuration Guide

This guide explains how to configure the dynamic authentication system for the Quilt MCP Server integration.

## Required Configuration

### JWT Signing Configuration

The enhanced JWT token generation requires two configuration values to be set in your deployment:

#### 1. MCP Enhanced JWT Secret (`mcpEnhancedJwtSecret`)

**Required**: A shared secret used to sign enhanced MCP JWT tokens using HS256 algorithm.

**Example**:

```json
{
  "mcpEnhancedJwtSecret": "your-super-secret-jwt-signing-key-here-must-be-at-least-32-characters"
}
```

**Security Requirements**:

- Minimum 32 characters
- Use a cryptographically secure random string
- Keep secret and never commit to version control
- Use different secrets for different environments (dev/staging/prod)

**Generation**:

```bash
# Generate a secure random secret (64 characters)
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 2. MCP Enhanced JWT Key ID (`mcpEnhancedJwtKid`) - Optional

**Optional**: A key identifier attached to enhanced MCP JWT signatures for key rotation support.

**Example**:

```json
{
  "mcpEnhancedJwtKid": "quilt-mcp-v1"
}
```

## Environment-Specific Configuration

### Development Environment

For local development, you can set these values in your local configuration:

```javascript
// In your local config file
{
  "mcpEnhancedJwtSecret": "dev-secret-key-for-local-development-only",
  "mcpEnhancedJwtKid": "dev-v1"
}
```

### Production Environment

For production deployments, these values should be:

1. **Generated securely** using cryptographically secure random generators
2. **Stored securely** in your deployment configuration (e.g., AWS Secrets Manager, Kubernetes secrets)
3. **Rotated regularly** for security best practices
4. **Shared with MCP server** so it can validate the tokens

## MCP Server Configuration

The MCP server must be configured with the same JWT secret to validate the enhanced tokens:

```yaml
# MCP Server Configuration
jwt:
  secret: 'your-super-secret-jwt-signing-key-here-must-be-at-least-32-characters'
  keyId: 'quilt-mcp-v1' # Optional, must match if provided
  algorithm: 'HS256'
```

## Configuration Validation

The system will automatically validate the configuration:

- ✅ **JWT Secret Present**: Enhanced token generation enabled
- ❌ **JWT Secret Missing**: Falls back to original unsigned token
- ⚠️ **JWT Secret Too Short**: Warning logged, may cause validation failures

## Testing Configuration

Use the Integration Test component in the Qurator DevTools to validate your configuration:

1. Open Qurator Assistant
2. Go to DevTools section
3. Run "Integration Test Suite"
4. Check "Enhanced JWT Token Generation" tests

## Troubleshooting

### Common Issues

#### 1. "Enhanced token is identical to original token"

**Cause**: JWT secret not configured or too short
**Solution**: Set `mcpEnhancedJwtSecret` in your configuration

#### 2. "MCP server rejects enhanced tokens"

**Cause**: MCP server not configured with matching JWT secret
**Solution**: Configure MCP server with the same `mcpEnhancedJwtSecret`

#### 3. "Token validation fails"

**Cause**: Key ID mismatch between frontend and MCP server
**Solution**: Ensure `mcpEnhancedJwtKid` matches on both sides, or remove it entirely

### Debug Information

Enable debug logging to troubleshoot JWT issues:

```javascript
// In browser console
localStorage.setItem('debug', 'quilt:mcp:jwt')
```

This will show detailed JWT generation and validation logs.

## Security Best Practices

1. **Never commit secrets to version control**
2. **Use different secrets for each environment**
3. **Rotate secrets regularly** (recommended: every 90 days)
4. **Monitor for unauthorized token usage**
5. **Use strong, random secrets** (minimum 32 characters)
6. **Store secrets securely** (use proper secret management)

## Example Complete Configuration

```json
{
  "mcpEndpoint": "https://your-mcp-server.com/mcp",
  "mcpEnhancedJwtSecret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
  "mcpEnhancedJwtKid": "quilt-mcp-v1",
  "qurator": true
}
```

## Support

If you encounter issues with the configuration:

1. Check the browser console for error messages
2. Run the Integration Test Suite
3. Verify MCP server configuration matches frontend
4. Contact the development team with specific error details
