# MCP Authentication Fix - Technical Implementation Specification

## Overview

This document provides detailed technical specifications for fixing the MCP authentication issue where the frontend is sending unenhanced JWT tokens instead of enhanced JWTs with roles, permissions, and buckets.

## Problem Statement

The Quilt frontend is experiencing a critical authentication issue:

1. **Frontend sends unenhanced JWT tokens** to MCP endpoints
2. **MCP server falls back to IAM authentication** because it cannot parse unenhanced tokens
3. **Race condition exists** between `get_credentials` and MCP calls
4. **User authentication shows as IAM-only** instead of JWT-based

## Current State Analysis

### Frontend Token Flow (Broken)
```
1. User logs in → Basic JWT token generated
2. get_credentials called → Should generate enhanced JWT
3. MCP initialize called → Uses old basic JWT (NO Authorization header)
4. MCP notifications/initialized called → Uses old basic JWT again
5. MCP server → Falls back to IAM authentication
```

### Expected Token Flow (Fixed)
```
1. User logs in → Basic JWT token generated
2. get_credentials called → Enhanced JWT generated with roles/permissions/buckets
3. MCP initialize called → Uses enhanced JWT in Authorization header
4. MCP notifications/initialized called → Uses enhanced JWT in Authorization header
5. MCP server → Processes enhanced JWT successfully
```

## Technical Implementation

### 1. Enhanced Token Generator Fix

**File**: `catalog/app/services/EnhancedTokenGenerator.js`

**Current Issue**: The enhanced token generator may not be properly integrated.

**Required Changes**:

```javascript
// Ensure the enhanced token generator is properly exported and used
export class EnhancedTokenGenerator {
  static generateEnhancedToken(originalToken, authorization) {
    // ... existing code ...
    
    // Add debugging
    console.log('🔧 EnhancedTokenGenerator: Generating enhanced JWT', {
      originalTokenLength: originalToken?.length,
      hasAuthorization: !!authorization,
      rolesCount: authorization?.roles?.length,
      permissionsCount: authorization?.awsPermissions?.size,
      bucketsCount: authorization?.buckets?.length
    });
    
    // ... rest of implementation ...
    
    // Add validation
    const enhancedToken = jwt.sign(enhancedPayload, secret, { 
      algorithm: 'HS256',
      header: { kid: 'frontend-enhanced' }
    });
    
    console.log('✅ EnhancedTokenGenerator: Enhanced JWT generated', {
      tokenLength: enhancedToken.length,
      payloadKeys: Object.keys(enhancedPayload)
    });
    
    return enhancedToken;
  }
}
```

### 2. Dynamic Auth Manager Fix

**File**: `catalog/app/services/DynamicAuthManager.js`

**Current Issue**: The auth manager is not properly using enhanced tokens.

**Required Changes**:

```javascript
export class DynamicAuthManager {
  constructor() {
    this.enhancedTokenGenerator = new EnhancedTokenGenerator();
    this.lastEnhancedToken = null;
    this.lastBasicToken = null;
  }

  async getCurrentToken() {
    // Always try to get enhanced token first
    if (this.lastEnhancedToken) {
      console.log('🔍 DynamicAuthManager: Using cached enhanced token');
      return this.lastEnhancedToken;
    }

    // Generate enhanced token if we have basic token
    if (this.lastBasicToken) {
      console.log('🔍 DynamicAuthManager: Generating enhanced token from basic token');
      try {
        const enhancedToken = await this.generateEnhancedToken(this.lastBasicToken);
        this.lastEnhancedToken = enhancedToken;
        return enhancedToken;
      } catch (error) {
        console.error('❌ DynamicAuthManager: Failed to generate enhanced token', error);
        // Fall back to basic token as last resort
        return this.lastBasicToken;
      }
    }

    console.warn('⚠️ DynamicAuthManager: No tokens available');
    return null;
  }

  async generateEnhancedToken(basicToken) {
    // Get authorization data
    const authorization = await this.getAuthorizationData();
    if (!authorization) {
      throw new Error('No authorization data available');
    }

    // Generate enhanced token
    const enhancedToken = EnhancedTokenGenerator.generateEnhancedToken(basicToken, authorization);
    
    // Validate the enhanced token
    const validation = this.validateEnhancedToken(enhancedToken);
    if (!validation.valid) {
      throw new Error(`Enhanced token validation failed: ${validation.reason}`);
    }

    return enhancedToken;
  }

  validateEnhancedToken(token) {
    if (!token) {
      return { valid: false, reason: 'Token is empty' };
    }

    try {
      const decoded = jwt.decode(token);
      const payload = decoded?.payload || decoded;

      if (!payload || typeof payload !== 'object') {
        return { valid: false, reason: 'Token payload missing' };
      }

      const hasRequiredClaims = !!(
        payload.roles &&
        payload.permissions &&
        payload.buckets &&
        payload.scope &&
        payload.level
      );

      if (!hasRequiredClaims) {
        return { valid: false, reason: 'Missing required enhanced claims' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: `Token decode failed: ${error.message}` };
    }
  }

  // Clear cache when new basic token is received
  async setBasicToken(token) {
    this.lastBasicToken = token;
    this.lastEnhancedToken = null; // Clear enhanced token to force regeneration
    console.log('🔄 DynamicAuthManager: Basic token updated, clearing enhanced token cache');
  }
}
```

### 3. MCP Client Fix

**File**: `catalog/app/components/Assistant/MCP/Client.ts`

**Current Issue**: The validation logic isn't working properly.

**Required Changes**:

```typescript
export class QuiltMCPClient {
  private validateEnhancedToken(token: string): { valid: boolean; reason?: string } {
    if (!token) {
      return { valid: false, reason: 'Token is empty' };
    }

    try {
      const decoded = decodeJwt(token) as { payload?: Record<string, any> };
      const payload = decoded?.payload;

      if (!payload || typeof payload !== 'object') {
        return { valid: false, reason: 'Token payload missing' };
      }

      // Check for enhanced token claims
      const hasRoles = Array.isArray(payload.roles) && payload.roles.length > 0;
      const hasPermissions = Array.isArray(payload.permissions) && payload.permissions.length > 0;
      const hasBuckets = Array.isArray(payload.buckets);
      const hasScope = typeof payload.scope === 'string';
      const hasLevel = typeof payload.level === 'string';

      if (!hasRoles || !hasPermissions || !hasBuckets || !hasScope || !hasLevel) {
        return {
          valid: false,
          reason: 'Token missing enhanced claims (roles/permissions/buckets/scope/level)',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `Token decode failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async acquireBearerToken(requestNumber: number): Promise<string> {
    const logPrefix = `MCP Request #${requestNumber}`;
    
    try {
      // Get token from auth manager
      const authManager = window.__dynamicAuthManager;
      if (!authManager) {
        throw new Error('DynamicAuthManager not available');
      }

      let accessToken = await authManager.getCurrentToken();
      
      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Validate the token
      const validation = this.validateEnhancedToken(accessToken);
      if (!validation.valid) {
        console.warn(`⚠️ ${logPrefix}: Token validation failed, clearing cache and retrying`, validation.reason);
        
        // Clear cache and try again
        await authManager.clearCache();
        await authManager.refreshAll();
        accessToken = await authManager.getCurrentToken();
        
        if (!accessToken) {
          throw new Error('No access token available after refresh');
        }

        // Validate again
        const retryValidation = this.validateEnhancedToken(accessToken);
        if (!retryValidation.valid) {
          throw new Error(`Enhanced token validation failed after refresh: ${retryValidation.reason}`);
        }
      }

      console.log(`✅ ${logPrefix}: Enhanced token acquired and validated`);
      return accessToken;
      
    } catch (error) {
      console.error(`❌ ${logPrefix}: Failed to acquire enhanced token`, error);
      throw error;
    }
  }

  private async getHeaders(requestNumber: number): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'mcp-protocol-version': '2024-11-05',
    };

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    if (!this.sessionId) {
      console.log(`🔍 MCP Request #${requestNumber}: Skipping Authorization header until session established`);
    } else {
      try {
        const accessToken = await this.acquireBearerToken(requestNumber);
        headers.Authorization = `Bearer ${accessToken}`;
        this.lastKnownAccessToken = accessToken;
        console.log(`✅ MCP Request #${requestNumber}: Enhanced JWT attached to Authorization header`);
      } catch (error) {
        console.error(`❌ MCP Request #${requestNumber}: Failed to attach Authorization header`, error);
        throw error;
      }
    }

    return headers;
  }
}
```

### 4. Authentication Flow Integration

**File**: `catalog/app/services/auth.js` (or similar)

**Required Changes**:

```javascript
// Ensure get_credentials response triggers enhanced token generation
export async function handleGetCredentialsResponse(response) {
  const { accessToken, ...otherData } = response;
  
  if (accessToken) {
    // Update auth manager with new basic token
    const authManager = window.__dynamicAuthManager;
    if (authManager) {
      await authManager.setBasicToken(accessToken);
      console.log('🔄 Auth: Basic token updated, enhanced token will be generated on next request');
    }
  }
  
  return response;
}

// Ensure MCP client is notified when tokens are updated
export function notifyMCPClientOfTokenUpdate() {
  const mcpClient = window.__mcpClient;
  if (mcpClient) {
    mcpClient.clearTokenCache();
    console.log('🔄 Auth: MCP client notified of token update');
  }
}
```

## Testing and Validation

### 1. Frontend Testing Script

Create a test script to run in browser console:

```javascript
// Test Enhanced Token Generation
(async function testEnhancedTokenGeneration() {
  console.log('🧪 Testing Enhanced Token Generation');
  
  const authManager = window.__dynamicAuthManager;
  if (!authManager) {
    console.error('❌ DynamicAuthManager not available');
    return;
  }

  // Clear cache and generate fresh token
  await authManager.clearCache();
  await authManager.refreshAll();
  
  const token = await authManager.getCurrentToken();
  if (!token) {
    console.error('❌ No token generated');
    return;
  }

  // Decode and analyze token
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4)));
  
  console.log('Token Analysis:', {
    hasRoles: !!payload.roles,
    hasPermissions: !!payload.permissions,
    hasBuckets: !!payload.buckets,
    hasScope: !!payload.scope,
    hasLevel: !!payload.level,
    rolesCount: payload.roles?.length,
    permissionsCount: payload.permissions?.length,
    bucketsCount: payload.buckets?.length
  });

  // Test MCP client
  const mcpClient = window.__mcpClient;
  if (mcpClient) {
    try {
      const headers = await mcpClient.getHeaders(1);
      console.log('MCP Headers:', {
        hasAuthorization: !!headers.Authorization,
        tokenLength: headers.Authorization?.length
      });
    } catch (error) {
      console.error('❌ MCP client test failed:', error);
    }
  }
})();
```

### 2. Backend Validation

Check CloudWatch logs for these messages:
- `✅ JWT authentication successful`
- `✅ Enhanced JWT processed`
- `❌ JWT validation failed` (should not appear)

### 3. Network Monitoring

Monitor browser network tab for:
- `get_credentials` call returns enhanced token
- MCP calls include `Authorization: Bearer <enhanced-token>` header
- No fallback to IAM authentication

## Success Criteria

1. **Enhanced JWTs generated** with roles, permissions, and buckets
2. **MCP client sends enhanced JWTs** in Authorization headers
3. **MCP server processes enhanced JWTs** without IAM fallback
4. **User authentication shows as JWT-based** in logs
5. **No race conditions** between authentication calls

## Rollback Plan

If issues arise:
1. Revert to previous Docker image
2. Clear browser cache
3. Monitor logs for authentication errors
4. Debug token generation and validation

## Monitoring

### Key Metrics
- Enhanced token generation success rate
- MCP request success rate with enhanced tokens
- Authentication fallback rate (should be 0%)
- User authentication method (JWT vs IAM)

### Alerts
- Enhanced token generation failures
- MCP authentication failures
- High IAM fallback rate
- Authentication errors in logs

This technical specification provides the exact code changes needed to fix the MCP authentication issue and ensure proper JWT-based authentication throughout the system.


