# COMPLETE MCP Authentication Fix Specification

## Executive Summary

The Quilt frontend is experiencing a critical authentication issue where **unenhanced JWT tokens are being sent to MCP endpoints instead of enhanced JWTs with roles, permissions, and buckets**. This causes the MCP server to fall back to IAM authentication, resulting in users appearing as IAM-only authenticated instead of JWT-based authenticated.

## Root Cause Analysis

### The Problem Chain
1. **User logs in** → Basic JWT token stored in Redux
2. **AWS Credentials refresh** → Calls `/auth/get_credentials` with basic JWT
3. **MCP client initializes** → Uses basic JWT (or no Authorization header)
4. **MCP server receives basic JWT** → Cannot parse enhanced claims
5. **MCP server falls back to IAM** → User appears as IAM-only authenticated

### Evidence from Current State

#### Frontend Behavior (from curl analysis):
```bash
# 1. get_credentials call - uses basic JWT
curl 'https://demo-registry.quiltdata.com/api/auth/get_credentials' \
  -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6Ijg3OTVmMGNjLThkZWItNDBkZC05MTMyLTEzMzU3Yzk4Mzk4NCIsInV1aWQiOiJmYzg5MTFiZi1jMmIyLTRlMTgtOWMwYy0wYzVlYzlhNmYxNzciLCJleHAiOjE3NjcwNTQwMTB9.-JZl6Ahpx1_AMw2L6fI63uurQwPYJAzXlQy1YtttaWo'

# 2. MCP initialize call - NO Authorization header
curl 'https://demo.quiltdata.com/mcp/?t=1759321134189' \
  --data-raw '{"jsonrpc":"2.0","id":"init-session","method":"initialize",...}'

# 3. MCP notifications/initialized call - uses OLD basic JWT again
curl 'https://demo.quiltdata.com/mcp/?t=1759321134275' \
  -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6Ijg3OTVmMGNjLThkZWItNDBkZC05MTMyLTEzMzU3Yzk4Mzk4NCIsInV1aWQiOiJmYzg5MTFiZi1jMmIyLTRlMTgtOWMwYy0wYzVlYzlhNmYxNzciLCJleHAiOjE3NjcwNTQwMTB9.-JZl6Ahpx1_AMw2L6fI63uurQwPYJAzXlQy1YtttaWo'
```

#### Backend Behavior (from CloudWatch logs):
```
WARNING:quilt_mcp.tools.buckets:⚠️  FALLING BACK to traditional authentication for list_available_resources (environment: web-unauthenticated)
WARNING:quilt_mcp.tools.buckets:This means NO JWT was found in runtime context!
WARNING:quilt_mcp.utils:MCP session default-session: No auth header for initialize, allowing for initialization
WARNING:quilt_mcp.utils:⚠️  Setting runtime context to UNAUTHENTICATED - tools will NOT have JWT!
```

## Complete Technical Analysis

### Current Authentication Flow (BROKEN)

```mermaid
graph TD
    A[User Login] --> B[Basic JWT stored in Redux]
    B --> C[AWS Credentials refresh]
    C --> D[get_credentials API call with basic JWT]
    D --> E[Returns AWS credentials only]
    E --> F[MCP Client initializes]
    F --> G[Uses basic JWT or no Authorization header]
    G --> H[MCP Server receives basic JWT]
    H --> I[Cannot parse enhanced claims]
    I --> J[Falls back to IAM authentication]
    J --> K[User appears as IAM-only]
```

### Required Authentication Flow (FIXED)

```mermaid
graph TD
    A[User Login] --> B[Basic JWT stored in Redux]
    B --> C[AWS Credentials refresh]
    C --> D[get_credentials API call with basic JWT]
    D --> E[Returns AWS credentials + enhanced JWT]
    E --> F[Enhanced JWT stored in DynamicAuthManager]
    F --> G[MCP Client initializes]
    G --> H[Uses enhanced JWT in Authorization header]
    H --> I[MCP Server receives enhanced JWT]
    I --> J[Parses roles, permissions, buckets]
    J --> K[User appears as JWT-based authenticated]
```

## Complete Implementation Plan

### Phase 1: Fix Token Generation and Caching

#### 1.1 Fix DynamicAuthManager Token Flow

**File**: `catalog/app/services/DynamicAuthManager.js`

**Current Issue**: The `getCurrentToken()` method returns basic tokens when no roles are available, and doesn't properly coordinate with the authentication flow.

**Required Changes**:

```javascript
class DynamicAuthManager {
  constructor(reduxStore, tokenGetter = null) {
    this.reduxStore = reduxStore
    this.tokenGetter = tokenGetter
    this.bucketDiscovery = new BucketDiscoveryService()
    this.awsBucketDiscovery = new AWSBucketDiscoveryService()
    this.tokenGenerator = new EnhancedTokenGenerator()
    this.jwtValidator = new JWTValidator(this)

    this.currentBuckets = []
    this.currentToken = null
    this.isInitialized = false
    this.currentRole = null
    this.availableRoles = []
    
    // Add enhanced token tracking
    this.lastEnhancedToken = null
    this.lastBasicToken = null
    this.enhancementInProgress = false

    this.config = {
      enableDynamicDiscovery: true,
      enableTokenEnhancement: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      refreshThreshold: 60 * 1000, // 1 minute before expiry
      autoRefreshOnError: true,
      // Add new config
      forceEnhancedTokens: true, // Always require enhanced tokens for MCP
    }
  }

  async getCurrentToken() {
    try {
      if (!this.isInitialized) await this.initialize()

      const originalToken = await this.getOriginalToken()
      if (!originalToken) {
        console.warn('⚠️ DynamicAuthManager: No bearer token available')
        return null
      }

      // CRITICAL: Always try to generate enhanced token
      // Don't fall back to basic token for MCP usage
      if (this.config.forceEnhancedTokens) {
        const enhancedToken = await this.generateEnhancedToken(originalToken)
        if (enhancedToken) {
          this.lastEnhancedToken = enhancedToken
          return enhancedToken
        }
        
        // If we can't generate enhanced token, return null instead of basic token
        console.error('❌ DynamicAuthManager: Cannot generate enhanced token, returning null')
        return null
      }

      // Legacy behavior (only if forceEnhancedTokens is false)
      const userRoles = this.getUserRolesFromState()
      if (userRoles.length === 0) {
        console.warn('⚠️ DynamicAuthManager: No roles available, returning basic token')
        return originalToken
      }

      // ... rest of existing logic
    } catch (error) {
      console.error('❌ DynamicAuthManager: getCurrentToken failed', error)
      return null
    }
  }

  async generateEnhancedToken(basicToken) {
    if (this.enhancementInProgress) {
      console.log('🔄 DynamicAuthManager: Enhancement already in progress, waiting...')
      // Wait for current enhancement to complete
      while (this.enhancementInProgress) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return this.lastEnhancedToken
    }

    this.enhancementInProgress = true
    
    try {
      console.log('🔄 DynamicAuthManager: Generating enhanced token...')
      
      const userRoles = this.getUserRolesFromState()
      if (userRoles.length === 0) {
        console.warn('⚠️ DynamicAuthManager: No roles available for enhancement')
        return null
      }

      // Get buckets
      const buckets = await this.bucketDiscovery.getAccessibleBuckets({
        token: basicToken,
        roles: userRoles,
      })
      this.currentBuckets = buckets

      // Generate enhanced token
      const enhancedToken = await this.tokenGenerator.generateEnhancedToken({
        originalToken: basicToken,
        roles: userRoles,
        buckets,
      })

      // Validate the enhanced token
      const validation = await this.jwtValidator.validateToken(enhancedToken)
      if (!validation.valid) {
        console.error('❌ DynamicAuthManager: Enhanced token validation failed', validation)
        return null
      }

      console.log('✅ DynamicAuthManager: Enhanced token generated successfully')
      return enhancedToken
      
    } catch (error) {
      console.error('❌ DynamicAuthManager: Enhanced token generation failed', error)
      return null
    } finally {
      this.enhancementInProgress = false
    }
  }

  // Add method to clear enhanced token cache when basic token changes
  clearEnhancedTokenCache() {
    this.lastEnhancedToken = null
    this.enhancementInProgress = false
    console.log('🔄 DynamicAuthManager: Enhanced token cache cleared')
  }

  // Add method to set basic token and clear enhanced cache
  setBasicToken(token) {
    this.lastBasicToken = token
    this.clearEnhancedTokenCache()
    console.log('🔄 DynamicAuthManager: Basic token updated, enhanced cache cleared')
  }
}
```

#### 1.2 Fix Enhanced Token Generator

**File**: `catalog/app/services/EnhancedTokenGenerator.js`

**Current Issue**: The generator may not be properly integrated with the authentication flow.

**Required Changes**:

```javascript
export class EnhancedTokenGenerator {
  static async generateEnhancedToken({ originalToken, roles, buckets }) {
    console.log('🔧 EnhancedTokenGenerator: Starting token enhancement', {
      originalTokenLength: originalToken?.length,
      rolesCount: roles?.length,
      bucketsCount: buckets?.length
    })

    if (!originalToken) {
      throw new Error('Original token is required')
    }

    if (!roles || roles.length === 0) {
      throw new Error('Roles are required for enhanced token generation')
    }

    // Decode original token
    const originalPayload = decodeJwt(originalToken)
    if (!originalPayload) {
      throw new Error('Failed to decode original token')
    }

    // Get authorization data
    const authorization = mergeAuthorizationForRoles(roles)
    if (!authorization) {
      throw new Error('Failed to get authorization data for roles')
    }

    // Get JWT secret and KID
    const secret = cfg.mcpEnhancedJwtSecret
    const kid = cfg.mcpEnhancedJwtKid || 'frontend-enhanced'

    if (!secret) {
      throw new Error('MCP enhanced JWT secret not configured')
    }

    // Build enhanced payload
    const rolesClaim = toUniqueArray(originalPayload.roles, authorization.roles)
    const fullPermissions = Array.from(authorization.awsPermissions).sort()
    const bucketNames = normalizeBucketNames(buckets)

    const enhancedPayload = {
      ...originalPayload,
      // Standard JWT claims
      iss: originalPayload.iss || 'quilt-frontend',
      aud: originalPayload.aud || 'quilt-mcp-server',
      sub: originalPayload.sub || originalPayload.id,
      iat: Math.floor(Date.now() / 1000),
      exp: originalPayload.exp || Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
      jti: originalPayload.jti || `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 4)}`,

      // Enhanced claims - UNCOMPRESSED for backend compatibility
      scope: 'write',
      level: authorization.level,
      roles: rolesClaim,
      permissions: fullPermissions,
      buckets: bucketNames, // Full bucket list (no compression)
      
      // Add token type indicator
      token_type: 'enhanced',
    }

    // Sign the enhanced token
    const enhancedToken = signJwt(enhancedPayload, secret, { 
      algorithm: 'HS256',
      header: { kid }
    })

    console.log('✅ EnhancedTokenGenerator: Enhanced token generated', {
      tokenLength: enhancedToken.length,
      payloadKeys: Object.keys(enhancedPayload),
      rolesCount: rolesClaim.length,
      permissionsCount: fullPermissions.length,
      bucketsCount: bucketNames.length
    })

    return enhancedToken
  }
}
```

### Phase 2: Fix MCP Client Integration

#### 2.1 Fix MCP Client Token Validation

**File**: `catalog/app/components/Assistant/MCP/Client.ts`

**Current Issue**: The validation logic isn't working properly and the client isn't properly coordinating with DynamicAuthManager.

**Required Changes**:

```typescript
export class QuiltMCPClient implements MCPClient {
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
      const hasTokenType = payload.token_type === 'enhanced';

      if (!hasRoles || !hasPermissions || !hasBuckets || !hasScope || !hasLevel) {
        return {
          valid: false,
          reason: 'Token missing enhanced claims (roles/permissions/buckets/scope/level)',
        };
      }

      if (!hasTokenType) {
        return {
          valid: false,
          reason: 'Token missing token_type: enhanced claim',
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
      // Get token from DynamicAuthManager
      const authManager = window.__dynamicAuthManager;
      if (!authManager) {
        throw new Error('DynamicAuthManager not available');
      }

      let accessToken = await authManager.getCurrentToken();
      
      if (!accessToken) {
        throw new Error('No access token available from DynamicAuthManager');
      }

      // Validate the token
      const validation = this.validateEnhancedToken(accessToken);
      if (!validation.valid) {
        console.warn(`⚠️ ${logPrefix}: Token validation failed, clearing cache and retrying`, validation.reason);
        
        // Clear cache and try again
        authManager.clearEnhancedTokenCache();
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

  // Add method to clear token cache when needed
  clearTokenCache() {
    this.lastKnownAccessToken = null;
    console.log('🔄 MCP Client: Token cache cleared');
  }
}
```

### Phase 3: Fix Authentication Flow Integration

#### 3.1 Fix MCP Context Provider

**File**: `catalog/app/components/Assistant/MCP/MCPContextProvider.tsx`

**Current Issue**: The provider isn't properly coordinating between authentication updates and MCP client.

**Required Changes**:

```typescript
function useMCPContextState(): State {
  const [state, setState] = React.useState<State>(INITIAL_STATE)
  const store = redux.useStore()

  // Initialize DynamicAuthManager
  const authManager = React.useMemo(
    () => {
      const manager = new DynamicAuthManager(store)
      // Expose to window for debugging and MCP client access
      if (typeof window !== 'undefined') {
        ;(window as any).__dynamicAuthManager = manager
      }
      return manager
    },
    [store],
  )

  // Force token refresh on page load to clear stale tokens
  React.useEffect(() => {
    const refreshTokensOnLoad = async () => {
      try {
        console.log('🔄 MCPContextProvider: Refreshing tokens on page load...')
        // Wait a moment for auth state to be ready
        await new Promise((resolve) => setTimeout(resolve, 500))
        
        // Force refresh all auth data to generate fresh tokens
        await authManager.refreshAll()
        console.log('✅ MCPContextProvider: Tokens refreshed successfully on page load')
      } catch (error) {
        console.warn('⚠️ MCPContextProvider: Failed to refresh tokens on load:', error)
      }
    }

    refreshTokensOnLoad()
  }, [authManager])

  // Set up Redux token getter for automatic token retrieval
  React.useEffect(() => {
    const extractTokenFromStore = async (): Promise<string | null> => {
      try {
        console.log('🔍 MCP Client: Redux token getter called...')
        
        // Use DynamicAuthManager to get enhanced token
        const enhancedToken = await authManager.getCurrentToken()
        if (enhancedToken) {
          console.log('✅ MCP Client: Enhanced token generated by DynamicAuthManager', {
            tokenLength: enhancedToken.length,
            tokenPreview: enhancedToken.substring(0, 50) + '...',
          })
          return enhancedToken
        }

        // CRITICAL: Do NOT fall back to basic OAuth token!
        console.error('❌ MCP Client: DynamicAuthManager failed to generate enhanced token')
        console.error('   This means the backend will reject any basic OAuth token')
        console.error('   Returning null to prevent authentication with wrong token type')
        return null
      } catch (error) {
        console.error('❌ MCP Client: Failed to get Redux access token:', error)
        return null
      }
    }

    // Create a simple Redux token getter for the auth manager
    const getReduxTokenForAuthManager = async (): Promise<string | null> => {
      try {
        const reduxState = store.getState() as any
        const { token } = findTokenInState(reduxState)
        return token
      } catch (error) {
        console.error('❌ AuthManager: Failed to get Redux token:', error)
        return null
      }
    }

    console.log('🔧 MCP Client: Setting up Redux token getter...')
    mcpClient.setReduxTokenGetter(extractTokenFromStore)
    authManager.tokenGetter = getReduxTokenForAuthManager
    console.log('✅ MCP Client: Redux token getter configured')
  }, [authManager, store])

  // Listen for authentication changes and update MCP client
  React.useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const state = store.getState() as any
      const { token } = findTokenInState(state)
      
      if (token && authManager) {
        // Update basic token in auth manager
        authManager.setBasicToken(token)
        
        // Clear MCP client cache to force token refresh
        if (mcpClient) {
          mcpClient.clearTokenCache()
        }
        
        console.log('🔄 MCPContextProvider: Authentication state changed, tokens refreshed')
      }
    })

    return unsubscribe
  }, [store, authManager])

  // ... rest of existing code
}
```

### Phase 4: Fix AWS Credentials Integration

#### 4.1 Fix AWS Credentials Provider

**File**: `catalog/app/utils/AWS/Credentials.js`

**Current Issue**: The AWS credentials refresh doesn't trigger enhanced token generation.

**Required Changes**:

```javascript
class RegistryCredentials extends AWS.Credentials {
  constructor({ req, reqOpts }) {
    super()
    this.req = req
    this.reqOpts = reqOpts
  }

  refresh(callback) {
    if (!this.refreshing) {
      this.refreshing = this.req({ endpoint: '/auth/get_credentials', ...this.reqOpts })
        .then((data) => {
          const expireTime = data.Expiration ? new Date(data.Expiration) : null
          if (expireTime?.getTime() < Date.now()) {
            throw new NewExpirationInThePastError(
              `We're getting credentials that are already expired. Check your computer's clock, please`,
            )
          }
          this.expireTime = expireTime
          this.accessKeyId = data.AccessKeyId
          this.secretAccessKey = data.SecretAccessKey
          this.sessionToken = data.SessionToken
          delete this.refreshing
          
          // CRITICAL: Trigger enhanced token generation after credentials refresh
          this.triggerEnhancedTokenGeneration()
          
          if (callback) callback()
        })
        .catch((e) => {
          delete this.refreshing
          if (/Outdated access token: please log in again/.test(e.message)) {
            this.error = new OutdatedTokenError(e.message)
          } else if (/Token could not be deserialized/.test(e.message)) {
            this.error = new InvalidTokenError(e.message)
          } else if (e instanceof NewExpirationInThePastError) {
            this.error = e
          } else {
            this.error = new CredentialsError(
              `Unable to fetch AWS credentials: ${e.message}`,
            )
          }
          if (callback) callback(this.error)
          throw this.error
        })
    }
    return this.refreshing
  }

  triggerEnhancedTokenGeneration() {
    // Trigger enhanced token generation after credentials refresh
    if (typeof window !== 'undefined' && window.__dynamicAuthManager) {
      console.log('🔄 AWS Credentials: Triggering enhanced token generation after credentials refresh')
      window.__dynamicAuthManager.clearEnhancedTokenCache()
      // The next MCP request will trigger enhanced token generation
    }
  }

  suspend() {
    if (this.error) throw this.error
    if (this.needsRefresh()) throw this.refresh()
    return this
  }
}
```

## Complete Testing Strategy

### 1. Frontend Testing

#### 1.1 Browser Console Test Script

```javascript
// Complete MCP Authentication Test
(async function testMCPAuthentication() {
  console.log('🧪 Complete MCP Authentication Test')
  console.log('='.repeat(70))
  
  // Test 1: Check DynamicAuthManager
  const authManager = window.__dynamicAuthManager
  if (!authManager) {
    console.error('❌ DynamicAuthManager not available')
    return
  }
  
  console.log('✅ DynamicAuthManager available')
  
  // Test 2: Clear cache and generate fresh token
  console.log('\n🔄 Clearing cache and generating fresh token...')
  authManager.clearEnhancedTokenCache()
  await authManager.refreshAll()
  
  const token = await authManager.getCurrentToken()
  if (!token) {
    console.error('❌ No token generated')
    return
  }
  
  console.log('✅ Token generated:', {
    length: token.length,
    preview: token.substring(0, 50) + '...'
  })
  
  // Test 3: Decode and analyze token
  const parts = token.split('.')
  const payload = JSON.parse(atob(parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4)))
  
  console.log('\n📊 Token Analysis:')
  console.log('  - Has roles:', !!payload.roles, `(${payload.roles?.length || 0} items)`)
  console.log('  - Has permissions:', !!payload.permissions, `(${payload.permissions?.length || 0} items)`)
  console.log('  - Has buckets:', !!payload.buckets, `(${payload.buckets?.length || 0} items)`)
  console.log('  - Has scope:', !!payload.scope, `(${payload.scope})`)
  console.log('  - Has level:', !!payload.level, `(${payload.level})`)
  console.log('  - Has token_type:', !!payload.token_type, `(${payload.token_type})`)
  
  // Test 4: Test MCP client
  const mcpClient = window.__mcpClient
  if (mcpClient) {
    console.log('\n🔧 Testing MCP Client...')
    try {
      const headers = await mcpClient.getHeaders(1)
      console.log('✅ MCP Headers generated:', {
        hasAuthorization: !!headers.Authorization,
        tokenLength: headers.Authorization?.length,
        tokenPreview: headers.Authorization?.substring(0, 50) + '...'
      })
    } catch (error) {
      console.error('❌ MCP client test failed:', error)
    }
  }
  
  // Test 5: Validate token format
  const isEnhanced = !!(
    payload.roles &&
    payload.permissions &&
    payload.buckets &&
    payload.scope &&
    payload.level &&
    payload.token_type === 'enhanced'
  )
  
  console.log('\n🎯 Final Result:')
  if (isEnhanced) {
    console.log('✅ ENHANCED TOKEN GENERATED SUCCESSFULLY!')
    console.log('   MCP server should now receive proper enhanced JWTs')
  } else {
    console.error('❌ TOKEN IS NOT ENHANCED!')
    console.error('   Missing required claims:', {
      roles: !payload.roles,
      permissions: !payload.permissions,
      buckets: !payload.buckets,
      scope: !payload.scope,
      level: !payload.level,
      token_type: payload.token_type !== 'enhanced'
    })
  }
  
  return { token, payload, isEnhanced }
})()
```

#### 1.2 Network Monitoring

Monitor browser network tab for:
- `get_credentials` call returns enhanced token
- MCP calls include `Authorization: Bearer <enhanced-token>` header
- No fallback to IAM authentication

### 2. Backend Testing

#### 2.1 CloudWatch Log Monitoring

Check for these messages in `/ecs/mcp-server-production`:
- `✅ JWT authentication successful`
- `✅ Enhanced JWT processed`
- `❌ JWT validation failed` (should not appear)

#### 2.2 Backend Validation Script

```python
# Backend JWT Validation Test
import jwt
import json

SECRET = "your-mcp-enhanced-jwt-secret"
TOKEN = "your-enhanced-token-here"

try:
    claims = jwt.decode(
        TOKEN,
        SECRET,
        algorithms=['HS256'],
        audience='quilt-mcp-server',
        issuer='quilt-frontend'
    )
    print("✅ SIGNATURE VERIFIED!")
    print(f"Roles: {claims.get('roles')}")
    print(f"Buckets: {len(claims.get('buckets', []))}")
    print(f"Permissions: {len(claims.get('permissions', []))}")
    print(f"Scope: {claims.get('scope')}")
    print(f"Level: {claims.get('level')}")
    print(f"Token Type: {claims.get('token_type')}")
except jwt.InvalidSignatureError as e:
    print(f"❌ SIGNATURE FAILED: {e}")
    print("This means frontend and backend are using DIFFERENT secrets!")
except Exception as e:
    print(f"❌ OTHER ERROR: {e}")
```

## Success Criteria

### 1. Frontend Success Criteria
- [ ] Enhanced JWTs generated with roles, permissions, and buckets
- [ ] MCP client sends enhanced JWTs in Authorization headers
- [ ] No fallback to basic OAuth tokens
- [ ] Token validation prevents unenhanced tokens from being sent

### 2. Backend Success Criteria
- [ ] MCP server processes enhanced JWTs without IAM fallback
- [ ] User authentication shows as JWT-based in logs
- [ ] All MCP tools work with proper user permissions
- [ ] No authentication errors in CloudWatch logs

### 3. Integration Success Criteria
- [ ] Complete authentication flow works end-to-end
- [ ] No race conditions between authentication calls
- [ ] User sees JWT-based authentication instead of IAM-only
- [ ] All MCP functionality works with proper authentication

## Rollback Plan

If issues arise:
1. Revert to previous Docker image
2. Clear browser cache
3. Monitor logs for authentication errors
4. Debug token generation and validation

## Monitoring and Alerts

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

## Files to Modify

### Primary Files
1. `catalog/app/services/DynamicAuthManager.js` - Core token management
2. `catalog/app/services/EnhancedTokenGenerator.js` - Token generation
3. `catalog/app/components/Assistant/MCP/Client.ts` - MCP client integration
4. `catalog/app/components/Assistant/MCP/MCPContextProvider.tsx` - Context provider
5. `catalog/app/utils/AWS/Credentials.js` - AWS credentials integration

### Secondary Files
- `catalog/app/services/mcpAuthorization.js` - Role mapping
- `catalog/app/services/BucketDiscoveryService.js` - Bucket discovery
- `catalog/app/services/JWTValidator.js` - Token validation

### Configuration Files
- `catalog/config.json.tmpl` - JWT secrets and configuration
- Environment variables for JWT secrets

## Expected Outcome

After implementing this complete specification:

1. **Enhanced JWTs will be generated** with proper roles, permissions, and buckets
2. **MCP client will send enhanced JWTs** in all requests
3. **MCP server will process enhanced JWTs** and provide proper authentication
4. **User will see JWT-based authentication** instead of IAM-only
5. **All MCP functionality will work** with proper user permissions
6. **No race conditions** will occur between authentication calls
7. **Complete end-to-end authentication** will work seamlessly

This specification provides a complete, comprehensive solution to the MCP authentication issue, ensuring that enhanced JWTs are properly generated, cached, and used throughout the system.


