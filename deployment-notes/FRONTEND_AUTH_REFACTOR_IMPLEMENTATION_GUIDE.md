# Frontend Authentication Refactor - Implementation Guide

**Date:** October 1, 2025  
**Approach:** Alexei's Recommended Pattern  
**Goal:** Remove JWT signing from browser, use existing catalog token

---

## Overview

We're simplifying the authentication flow from ~2000 lines of complex token enhancement to ~200 lines that just pass the existing catalog token to the MCP server.

---

## Step-by-Step Implementation

### Phase 1: Remove Secrets and JWT Signing (30 minutes)

#### 1.1 Remove Secret from Config

**File:** `catalog/config.json.tmpl`

```diff
{
  "registryUrl": "${registry_url}",
  "s3Proxy": "${s3_proxy}",
- "mcpEnhancedJwtSecret": "${mcp_enhanced_jwt_secret}",
- "mcpEnhancedJwtKid": "frontend-enhanced",
  "mcpEndpoint": "${mcp_endpoint}",
  // ... rest of config
}
```

#### 1.2 Delete Enhanced Token Generator

**Action:** Delete entire file
```bash
rm catalog/app/services/EnhancedTokenGenerator.js
```

#### 1.3 Delete JWT Compression Utils

**Action:** Delete these files
```bash
rm catalog/app/services/jwt-decompression-utils.js
rm catalog/app/services/JWTCompressionFormat.md
rm catalog/app/services/MCP_Server_JWT_Decompression_Guide.md
rm catalog/app/services/test-jwt-decompression.js
```

#### 1.4 Remove JWT Validation Service

**Action:** Delete entire file (we'll validate on backend only)
```bash
rm catalog/app/services/JWTValidator.js
```

---

### Phase 2: Simplify DynamicAuthManager (1 hour)

**File:** `catalog/app/services/DynamicAuthManager.js`

Replace the entire file with this simplified version:

```javascript
/**
 * Simplified DynamicAuthManager - Just gets catalog token from Redux
 * No JWT signing, no enhancement, no complexity
 * 
 * Based on Alexei's recommendation: "just reuse the token"
 */

export class DynamicAuthManager {
  constructor(reduxStore) {
    this.reduxStore = reduxStore
    this.lastToken = null
    
    console.log('✅ DynamicAuthManager initialized (simplified)')
  }

  /**
   * Get the current catalog authentication token from Redux state
   * This is the ONLY token we need - no enhancement required
   */
  async getCurrentToken() {
    try {
      const state = this.reduxStore.getState()
      const token = this.findTokenInState(state)
      
      if (!token) {
        console.warn('⚠️ DynamicAuthManager: No catalog token available')
        return null
      }
      
      // Cache for debugging
      this.lastToken = token
      
      console.log('✅ DynamicAuthManager: Catalog token retrieved', {
        tokenLength: token.length,
        tokenPreview: token.substring(0, 30) + '...'
      })
      
      return token
    } catch (error) {
      console.error('❌ DynamicAuthManager: Failed to get token', error)
      return null
    }
  }

  /**
   * Find the authentication token in Redux state
   * Checks common locations where catalog stores the token
   */
  findTokenInState(state) {
    // Try common Redux state paths where catalog stores auth token
    const possiblePaths = [
      state.auth?.tokens?.access_token,
      state.auth?.token,
      state.session?.token,
      state.user?.token,
    ]

    for (const token of possiblePaths) {
      if (token && typeof token === 'string') {
        return token
      }
    }

    // Fallback: search entire state for token-like strings
    return this.deepSearchForToken(state)
  }

  /**
   * Deep search for token in state (fallback)
   */
  deepSearchForToken(obj, depth = 0) {
    if (depth > 5) return null // Prevent infinite recursion
    
    if (typeof obj !== 'object' || obj === null) return null

    for (const [key, value] of Object.entries(obj)) {
      // Look for keys that suggest auth tokens
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
        if (typeof value === 'string' && value.length > 50) {
          return value
        }
      }
      
      // Recurse
      const found = this.deepSearchForToken(value, depth + 1)
      if (found) return found
    }

    return null
  }

  /**
   * Clear cached token (for testing or logout)
   */
  clearCache() {
    this.lastToken = null
    console.log('🔄 DynamicAuthManager: Cache cleared')
  }

  /**
   * Get info for debugging
   */
  getDebugInfo() {
    return {
      hasToken: !!this.lastToken,
      tokenLength: this.lastToken?.length,
      tokenPreview: this.lastToken?.substring(0, 50) + '...',
      reduxStoreAvailable: !!this.reduxStore,
    }
  }
}

// Export singleton instance creator
export function createDynamicAuthManager(reduxStore) {
  return new DynamicAuthManager(reduxStore)
}
```

**File:** `catalog/app/services/DynamicAuthManager.d.ts`

Update TypeScript definitions:

```typescript
export class DynamicAuthManager {
  constructor(reduxStore: any);
  getCurrentToken(): Promise<string | null>;
  findTokenInState(state: any): string | null;
  clearCache(): void;
  getDebugInfo(): {
    hasToken: boolean;
    tokenLength: number | undefined;
    tokenPreview: string;
    reduxStoreAvailable: boolean;
  };
}

export function createDynamicAuthManager(reduxStore: any): DynamicAuthManager;
```

---

### Phase 3: Simplify MCP Client (1 hour)

**File:** `catalog/app/components/Assistant/MCP/Client.ts`

Replace the token acquisition logic:

```typescript
export class QuiltMCPClient implements MCPClient {
  private sessionId: string | null = null
  private lastKnownAccessToken: string | null = null
  private authManager: DynamicAuthManager | null = null

  constructor(private endpoint: string) {
    console.log('🔧 QuiltMCPClient initialized with endpoint:', endpoint)
  }

  /**
   * Set the auth manager (called from MCPContextProvider)
   */
  setAuthManager(authManager: DynamicAuthManager) {
    this.authManager = authManager
    console.log('✅ MCP Client: Auth manager configured')
  }

  /**
   * Acquire bearer token - SIMPLIFIED VERSION
   * Just gets the catalog token from auth manager
   */
  private async acquireBearerToken(requestNumber: number): Promise<string> {
    const logPrefix = `MCP Request #${requestNumber}`
    
    if (!this.authManager) {
      throw new Error('Auth manager not configured')
    }

    try {
      const token = await this.authManager.getCurrentToken()
      
      if (!token) {
        throw new Error('No catalog token available')
      }

      console.log(`✅ ${logPrefix}: Catalog token acquired`)
      return token
      
    } catch (error) {
      console.error(`❌ ${logPrefix}: Failed to acquire token`, error)
      throw error
    }
  }

  /**
   * Get headers for MCP request
   * Always includes Authorization header with catalog token
   */
  private async getHeaders(requestNumber: number): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'mcp-protocol-version': '2024-11-05',
    }

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId
    }

    // ALWAYS include Authorization header (even for initialize)
    // Backend can choose to ignore it for initialize if needed
    try {
      const accessToken = await this.acquireBearerToken(requestNumber)
      headers.Authorization = `Bearer ${accessToken}`
      this.lastKnownAccessToken = accessToken
      
      console.log(`✅ MCP Request #${requestNumber}: Authorization header attached`)
    } catch (error) {
      console.error(`❌ MCP Request #${requestNumber}: Failed to attach Authorization header`, error)
      // Don't throw - let backend decide if token is required
    }

    return headers
  }

  /**
   * Clear cached token
   */
  clearTokenCache() {
    this.lastKnownAccessToken = null
    console.log('🔄 MCP Client: Token cache cleared')
  }

  /**
   * Send MCP request
   */
  async sendRequest(method: string, params?: any): Promise<any> {
    const requestNumber = Date.now()
    
    try {
      const headers = await this.getHeaders(requestNumber)
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: requestNumber,
          method,
          params: params || {},
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(`MCP Error: ${data.error.message}`)
      }

      return data.result
      
    } catch (error) {
      console.error(`❌ MCP Request #${requestNumber} failed:`, error)
      throw error
    }
  }

  /**
   * Initialize MCP session
   */
  async initialize(params: any): Promise<any> {
    console.log('🔄 MCP Client: Initializing session...')
    
    const result = await this.sendRequest('initialize', params)
    
    // Extract session ID from response if provided
    if (result.sessionId) {
      this.sessionId = result.sessionId
      console.log('✅ MCP Client: Session initialized', this.sessionId)
    }
    
    return result
  }

  /**
   * Call MCP tool
   */
  async callTool(name: string, args?: any): Promise<any> {
    return this.sendRequest('tools/call', {
      name,
      arguments: args || {},
    })
  }

  /**
   * List available tools
   */
  async listTools(): Promise<any> {
    return this.sendRequest('tools/list')
  }
}
```

---

### Phase 4: Update MCP Context Provider (30 minutes)

**File:** `catalog/app/components/Assistant/MCP/MCPContextProvider.tsx`

Simplify the context provider:

```typescript
import * as React from 'react'
import * as redux from 'react-redux'
import { DynamicAuthManager } from 'services/DynamicAuthManager'
import { QuiltMCPClient } from './Client'
import cfg from 'constants/config'

interface State {
  client: QuiltMCPClient | null
  initialized: boolean
  error: string | null
}

const INITIAL_STATE: State = {
  client: null,
  initialized: false,
  error: null,
}

function useMCPContextState(): State {
  const [state, setState] = React.useState<State>(INITIAL_STATE)
  const store = redux.useStore()

  // Create auth manager (simplified - no complex setup)
  const authManager = React.useMemo(
    () => {
      const manager = new DynamicAuthManager(store)
      
      // Expose to window for debugging
      if (typeof window !== 'undefined') {
        ;(window as any).__dynamicAuthManager = manager
      }
      
      return manager
    },
    [store],
  )

  // Create MCP client
  const client = React.useMemo(
    () => {
      const mcpClient = new QuiltMCPClient(cfg.mcpEndpoint)
      mcpClient.setAuthManager(authManager)
      
      // Expose to window for debugging
      if (typeof window !== 'undefined') {
        ;(window as any).__mcpClient = mcpClient
      }
      
      return mcpClient
    },
    [authManager],
  )

  // Initialize on mount
  React.useEffect(() => {
    const initializeClient = async () => {
      try {
        console.log('🔄 MCPContextProvider: Initializing MCP client...')
        
        await client.initialize({
          protocolVersion: '2024-11-05',
          clientInfo: {
            name: 'quilt-catalog',
            version: cfg.stackVersion || '1.0.0',
          },
        })

        setState({
          client,
          initialized: true,
          error: null,
        })
        
        console.log('✅ MCPContextProvider: MCP client initialized')
      } catch (error) {
        console.error('❌ MCPContextProvider: Initialization failed', error)
        setState({
          client: null,
          initialized: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    initializeClient()
  }, [client])

  // Listen for auth changes and clear token cache
  React.useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const state = store.getState() as any
      const currentToken = authManager.findTokenInState(state)
      
      if (currentToken) {
        // Token changed - clear MCP client cache
        client.clearTokenCache()
        console.log('🔄 MCPContextProvider: Auth token changed, cache cleared')
      }
    })

    return unsubscribe
  }, [store, authManager, client])

  return state
}

// Create context
const MCPContext = React.createContext<State>(INITIAL_STATE)

// Provider component
export function MCPContextProvider({ children }: { children: React.ReactNode }) {
  const state = useMCPContextState()
  
  return <MCPContext.Provider value={state}>{children}</MCPContext.Provider>
}

// Hook to use MCP context
export function useMCPContext() {
  return React.useContext(MCPContext)
}
```

---

### Phase 5: Remove References to Deleted Services (30 minutes)

#### 5.1 Find and Remove Imports

Search for and remove these imports across the codebase:

```bash
# Find files importing deleted services
grep -r "EnhancedTokenGenerator" catalog/app/
grep -r "JWTValidator" catalog/app/
grep -r "jwt-decompression" catalog/app/

# Remove imports from those files
```

#### 5.2 Remove from Index Files

**File:** `catalog/app/services/index.ts` (if it exists)

Remove exports:
```diff
- export { EnhancedTokenGenerator } from './EnhancedTokenGenerator'
- export { JWTValidator } from './JWTValidator'
```

---

### Phase 6: Update Configuration (15 minutes)

#### 6.1 Update Config Schema

**File:** `catalog/config-schema.json`

Remove enhanced JWT config:
```diff
{
  "properties": {
    "registryUrl": { "type": "string" },
    "mcpEndpoint": { "type": "string" },
-   "mcpEnhancedJwtSecret": { "type": "string" },
-   "mcpEnhancedJwtKid": { "type": "string" },
    // ... rest
  }
}
```

#### 6.2 Update Environment Variables

**Action:** Remove from deployment config
- Remove `MCP_ENHANCED_JWT_SECRET` from environment variables
- Remove `MCP_ENHANCED_JWT_KID` from environment variables

---

### Phase 7: Testing (1 hour)

#### 7.1 Browser Console Test

Open browser console and run:

```javascript
// Test the simplified auth flow
(async function testSimplifiedAuth() {
  console.log('🧪 Testing Simplified Authentication')
  console.log('='.repeat(70))
  
  // Check auth manager
  const authManager = window.__dynamicAuthManager
  if (!authManager) {
    console.error('❌ Auth manager not available')
    return
  }
  
  console.log('✅ Auth manager available')
  console.log('Debug info:', authManager.getDebugInfo())
  
  // Get token
  const token = await authManager.getCurrentToken()
  if (!token) {
    console.error('❌ No token retrieved')
    return
  }
  
  console.log('✅ Token retrieved:', {
    length: token.length,
    preview: token.substring(0, 50) + '...'
  })
  
  // Check MCP client
  const mcpClient = window.__mcpClient
  if (!mcpClient) {
    console.error('❌ MCP client not available')
    return
  }
  
  console.log('✅ MCP client available')
  
  // Try making a request
  try {
    const tools = await mcpClient.listTools()
    console.log('✅ MCP request successful!', {
      toolCount: tools.tools?.length || 0
    })
  } catch (error) {
    console.error('❌ MCP request failed:', error)
  }
  
  console.log('\n🎯 Summary:')
  console.log('  - Auth manager: ✅')
  console.log('  - Token retrieval: ✅')
  console.log('  - MCP client: ✅')
  console.log('  - MCP request: Check above')
})()
```

#### 7.2 Network Tab Verification

Open browser DevTools → Network tab → Filter for MCP requests

**Check:**
- ✅ Authorization header present in all requests
- ✅ Header format: `Authorization: Bearer <token>`
- ✅ Token is the catalog token (not an enhanced one)
- ✅ No errors in console about missing secrets

#### 7.3 Manual Testing Checklist

- [ ] Log in to catalog
- [ ] Open MCP assistant
- [ ] Verify no console errors
- [ ] Make an MCP request (e.g., list packages)
- [ ] Check Authorization header in Network tab
- [ ] Switch user roles (if applicable)
- [ ] Verify MCP still works after role switch
- [ ] Log out and verify MCP stops working
- [ ] Log back in and verify MCP works again

---

## Rollback Plan

If something goes wrong:

### Quick Rollback
```bash
# Restore from git
git checkout HEAD -- catalog/app/services/
git checkout HEAD -- catalog/app/components/Assistant/MCP/
git checkout HEAD -- catalog/config.json.tmpl
```

### Clean Browser State
```javascript
// In browser console
localStorage.clear()
sessionStorage.clear()
location.reload(true)
```

---

## Success Criteria

### ✅ Code Quality
- [ ] No JWT signing in browser code
- [ ] No secrets in frontend config
- [ ] DynamicAuthManager < 150 lines
- [ ] MCP Client simplified
- [ ] All deleted files removed from git

### ✅ Functionality
- [ ] Catalog token retrieved successfully
- [ ] MCP requests include Authorization header
- [ ] Backend receives and validates token
- [ ] All MCP tools work
- [ ] Role switching works

### ✅ Security
- [ ] No secrets exposed to browser
- [ ] No console warnings about missing secrets
- [ ] Authorization header present in all requests
- [ ] Token is the catalog token, not enhanced

---

## Estimated Timeline

| Phase | Time | Description |
|-------|------|-------------|
| 1 | 30 min | Remove secrets and delete files |
| 2 | 1 hour | Simplify DynamicAuthManager |
| 3 | 1 hour | Simplify MCP Client |
| 4 | 30 min | Update MCP Context Provider |
| 5 | 30 min | Remove old references |
| 6 | 15 min | Update configuration |
| 7 | 1 hour | Testing |
| **Total** | **4.5 hours** | **Complete frontend refactor** |

---

## Next Steps After Frontend Complete

1. **Deploy frontend changes**
   - Build production bundle
   - Verify no secrets in bundle
   - Deploy to demo environment

2. **Verify with backend**
   - Backend should receive catalog tokens
   - Backend validates with registry
   - End-to-end flow works

3. **Document the change**
   - Update team on new architecture
   - Create runbook for debugging
   - Update onboarding docs

---

## Questions? Issues?

If you run into problems:

1. Check browser console for errors
2. Verify Redux state has auth token
3. Check Network tab for Authorization header
4. Verify backend is accepting tokens
5. Contact Alexei if validation fails

---

**Ready to start? Begin with Phase 1 - it's irreversible but safe (just deletes unnecessary files).**


