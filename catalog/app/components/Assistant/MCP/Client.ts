/**
 * MCP Client - Real Server Connection
 */
/* eslint-disable no-console */

import cfg from 'constants/config'

import type {
  MCPClient,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPServerConfig,
  OAuthDiscovery,
  OAuthToken,
  OAuthAuthState,
} from './types'

const MCP_PROTOCOL_VERSION = '2024-11-05'

export class QuiltMCPClient implements MCPClient {
  private baseUrl: string

  private isSSEEndpoint: boolean

  private sessionId: string | null = null

  // Server information
  private serverInfo: { name?: string; version?: string } | null = null

  // OAuth properties
  private oauthDiscovery: OAuthDiscovery | null = null

  private oauthToken: OAuthToken | null = null

  private oauthAuthState: OAuthAuthState | null = null

  // Role properties
  private currentRole: { name: string; arn?: string } | null = null

  private availableRoles: { name: string; arn?: string }[] = []

  // Redux token getter (set by MCPContextProvider)
  private reduxTokenGetter: (() => Promise<string | null>) | null = null

  constructor() {
    // Expose global function for quick debug toggle
    if (typeof window !== 'undefined') {
      ;(window as any).enableMCPDebug = (enabled: boolean = true) => {
        localStorage.setItem('mcp-debug-logging', enabled ? 'true' : 'false')
        console.log(
          `🐛 MCP Debug Logging ${enabled ? 'enabled' : 'disabled'}. ` +
            'Changes will take effect on next MCP request.',
        )
        // Dispatch event to notify UI
        window.dispatchEvent(
          new CustomEvent('mcp-debug-changed', { detail: { enabled } }),
        )
      }
    }

    // Debug: Log the raw configuration
    console.log('🔍 MCP Client: Raw config object:', cfg)
    console.log('🔍 MCP Client: mcpEndpoint value:', cfg.mcpEndpoint)
    console.log('🔍 MCP Client: mcpEndpoint type:', typeof cfg.mcpEndpoint)

    // Use configuration-based URL selection
    if (cfg.mcpEndpoint && cfg.mcpEndpoint.trim() !== '') {
      this.baseUrl = cfg.mcpEndpoint.endsWith('/')
        ? cfg.mcpEndpoint
        : `${cfg.mcpEndpoint}/`

      // Detect if this is an SSE endpoint
      this.isSSEEndpoint = this.detectSSEEndpoint(cfg.mcpEndpoint)

      console.log('✅ MCP Client: Using configured endpoint:', this.baseUrl)
    } else {
      // Use HTTPS fallback for production compatibility
      this.baseUrl = 'https://demo.quiltdata.com/mcp/'
      this.isSSEEndpoint = false
      console.log(
        '⚠️ MCP Client: No endpoint configured, using HTTPS fallback:',
        this.baseUrl,
      )
    }

    // Log configuration for debugging (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('MCP Client Configuration:', {
        endpoint: this.baseUrl,
        isSSE: this.isSSEEndpoint,
        isStreamableHttp: this.isStreamableHttp(cfg.mcpEndpoint || ''),
        acceptHeader: this.getAcceptHeader(),
        originalEndpoint: cfg.mcpEndpoint,
      })
    }
  }

  /**
   * Set the current user's role information for MCP requests
   */
  setRoleInfo(
    currentRole: { name: string; arn?: string } | null,
    availableRoles: { name: string; arn?: string }[] = [],
  ) {
    try {
      console.log('🔄 Setting MCP Role Info:', { currentRole, availableRoles })
      this.currentRole = currentRole
      this.availableRoles = availableRoles

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ MCP Client Role Info Updated:', {
          currentRole: this.currentRole,
          availableRoles: this.availableRoles,
        })
      }
    } catch (error) {
      console.error('❌ Failed to set role information:', error)
      // Clear role information on error to prevent invalid state
      this.currentRole = null
      this.availableRoles = []
    }
  }

  /**
   * Get current role information
   */
  getRoleInfo() {
    return {
      currentRole: this.currentRole,
      availableRoles: this.availableRoles,
    }
  }

  /**
   * Get server information (name and version)
   */
  getServerInfo(): { name?: string; version?: string } | null {
    return this.serverInfo
  }

  /**
   * Get current authentication status
   */
  async getAuthenticationStatus() {
    const accessToken = await this.getAccessToken()
    const hasReduxToken = await this.hasReduxToken()

    let authenticationMethod = 'iam-role-fallback'
    if (accessToken) {
      authenticationMethod = hasReduxToken ? 'redux-bearer' : 'oauth-bearer'
    }

    return {
      hasBearerToken: !!accessToken,
      hasReduxToken,
      hasRoleInfo: !!this.currentRole,
      authenticationMethod,
      currentRole: this.currentRole,
      availableRoles: this.availableRoles,
    }
  }

  private async hasReduxToken(): Promise<boolean> {
    try {
      const reduxToken = await this.getReduxAccessToken()
      return !!reduxToken
    } catch (error) {
      return false
    }
  }

  /**
   * Handle role assumption errors from MCP server responses
   */
  private handleRoleAssumptionError(error: any): void {
    if (
      error?.message?.includes('role assumption') ||
      error?.message?.includes('assume role')
    ) {
      console.error('❌ Role assumption failed:', error.message)
      console.error('🔍 Role assumption error details:', {
        error: error,
        currentRole: this.currentRole,
        availableRoles: this.availableRoles,
        errorMessage: error.message,
        errorStack: error.stack,
      })
      // Could emit an event or show a notification to the user
      // For now, just log the error
    }
  }

  /**
   * Enhanced error handling for MCP responses
   */
  private handleMCPResponseError(error: any, context: string): void {
    console.error(`❌ MCP ${context} error:`, error.message)
    console.error('🔍 MCP Error details:', {
      context,
      error: error,
      currentRole: this.currentRole,
      errorMessage: error.message,
      errorStack: error.stack,
    })

    // Check for authentication errors
    if (error?.status === 401 || error?.message?.includes('Unauthorized')) {
      console.error('🔐 Authentication Error - Possible causes:')
      console.error('  1. Bearer token expired or invalid')
      console.error('  2. OAuth token refresh failed')
      console.error('  3. MCP server authentication configuration issue')
      console.error('  4. Token scope insufficient for requested operation')
    }

    // Check for access denied errors
    if (
      error?.message?.includes('Access Denied') ||
      error?.message?.includes('access denied')
    ) {
      console.error('🚨 Access Denied Error - Possible causes:')
      console.error('  1. Bearer token lacks required permissions')
      console.error('  2. Role trust policy issue - MCP server cannot assume the role')
      console.error('  3. Role permissions issue - Role lacks required S3 permissions')
      console.error('  4. Bucket policy issue - Bucket explicitly denies access')
      console.error(
        '  5. MCP server configuration issue - Server not properly configured',
      )
    }
  }

  private detectSSEEndpoint(endpoint: string): boolean {
    const lowerEndpoint = endpoint.toLowerCase()
    return (
      lowerEndpoint.includes('/sse') ||
      lowerEndpoint.includes('transport=sse') ||
      lowerEndpoint.includes('streamable-http') ||
      // Check for common SSE endpoint patterns
      lowerEndpoint.includes('/stream') ||
      lowerEndpoint.includes('/events')
    )
  }

  private isStreamableHttp(endpoint: string): boolean {
    const lowerEndpoint = endpoint.toLowerCase()
    return lowerEndpoint.includes('streamable-http')
  }

  private getAcceptHeader(): string {
    if (this.isSSEEndpoint) {
      return 'text/event-stream'
    } else if (this.isStreamableHttp(cfg.mcpEndpoint || '')) {
      return 'application/json, text/event-stream, application/x-ndjson'
    } else {
      return 'application/json, text/event-stream'
    }
  }

  async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: this.getAcceptHeader(),
      'Cache-Control': 'no-cache',
      'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    }

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId
    }

    // Add debug logging header if enabled
    const debugEnabled = localStorage.getItem('mcp-debug-logging') === 'true'
    if (debugEnabled) {
      headers['X-MCP-Debug'] = 'true'
      console.log(
        '🐛 MCP Debug Logging: Enabled - Detailed logs will be sent to CloudWatch',
      )
    }

    // Primary Authentication: Bearer Token (Redux or OAuth)
    const accessToken = await this.getAccessToken()
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
      const hasReduxToken = await this.hasReduxToken()
      if (hasReduxToken) {
        console.log('🔐 Using Redux Bearer Token Authentication (Automatic)')
      } else {
        console.log('🔐 Using OAuth Bearer Token Authentication')
      }

      // Debug: Decode token to check permissions
      if (process.env.NODE_ENV === 'development') {
        try {
          const tokenParts = accessToken.split('.')
          if (tokenParts.length === 3) {
            const payload = JSON.parse(
              atob(tokenParts[1] + '='.repeat((4 - (tokenParts[1].length % 4)) % 4)),
            )
            console.log('🔍 Token Claims:', {
              id: payload.id,
              sub: payload.sub,
              scope: payload.scope,
              permissions: payload.permissions,
              roles: payload.roles,
              groups: payload.groups,
              buckets: payload.buckets?.length || 0,
              aud: payload.aud,
              iss: payload.iss,
              iat: payload.iat
                ? new Date(payload.iat * 1000).toISOString()
                : 'No issued at',
              exp: payload.exp
                ? new Date(payload.exp * 1000).toISOString()
                : 'No expiration',
              jti: payload.jti,
              quilt: payload.quilt,
              token_type: payload.token_type,
              version: payload.version,
            })

            // Show actual JWT token being sent to MCP server
            console.log('🔍 JWT Token Being Sent to MCP Server:', {
              'Token Length': accessToken.length,
              'Token Preview': `${accessToken.substring(0, 50)}...`,
              'Authorization Header': `Bearer ${accessToken.substring(0, 20)}...`,
              'Full Headers': headers,
            })
          }
        } catch (error) {
          console.log(
            '⚠️ Could not decode token for debugging:',
            error instanceof Error ? error.message : String(error),
          )
        }
      }
    } else {
      console.log('⚠️ No bearer token available, falling back to IAM role headers')
    }

    // Fallback Authentication: IAM Role Headers (only if no bearer token)
    if (!accessToken && this.currentRole) {
      // Primary header: Send ARN if available, otherwise fall back to role name
      if (this.currentRole.arn) {
        headers['X-Quilt-User-Role'] = this.currentRole.arn
        headers['x-quilt-role-arn'] = this.currentRole.arn
      } else {
        headers['X-Quilt-User-Role'] = this.currentRole.name
      }

      // Additional headers for compatibility
      headers['x-quilt-current-role'] = this.currentRole.name

      console.log('🔑 Using IAM Role Header Authentication (Fallback)')
    }

    if (this.availableRoles.length > 0) {
      headers['x-quilt-available-roles'] = JSON.stringify(this.availableRoles)
    }

    // Debug logging for authentication
    if (process.env.NODE_ENV === 'development') {
      const authStatus = {
        hasBearerToken: !!accessToken,
        hasRoleInfo: !!this.currentRole,
        authenticationMethod: accessToken ? 'oauth-bearer' : 'iam-role-fallback',
        currentRole: this.currentRole,
        availableRoles: this.availableRoles?.length || 0,
        headers: {
          Authorization: headers.Authorization ? 'Bearer ***' : 'None',
          'X-Quilt-User-Role': headers['X-Quilt-User-Role'],
          'x-quilt-current-role': headers['x-quilt-current-role'],
          'x-quilt-role-arn': headers['x-quilt-role-arn'],
        },
      }

      console.log('🔍 MCP Authentication Debug:', authStatus)

      // Role validation debugging
      if (this.currentRole) {
        console.log('🎯 Role Selection Validation:', {
          currentRoleName: this.currentRole.name,
          currentRoleArn: this.currentRole.arn,
          isWriteRole:
            this.currentRole.name?.includes('Write') ||
            this.currentRole.name?.includes('write'),
          availableRoles: this.availableRoles?.map((r) => r.name) || [],
          roleSelectionMethod: 'active-role',
        })
      }

      // Additional debugging for role assumption (fallback only)
      if (!accessToken && this.currentRole?.arn) {
        console.log('🎯 IAM Role Fallback Debug:', {
          roleARN: this.currentRole.arn,
          roleName: this.currentRole.name,
          expectedFormat: 'arn:aws:iam::850787717197:role/ReadWriteQuiltV2-sales-prod',
          isCorrectFormat:
            this.currentRole.arn ===
            'arn:aws:iam::850787717197:role/ReadWriteQuiltV2-sales-prod',
        })
      }
    }

    return headers
  }

  async initialize(): Promise<void> {
    if (this.sessionId) return

    // Check if MCP endpoint is configured
    if (!cfg.mcpEndpoint || cfg.mcpEndpoint.trim() === '') {
      throw new Error('MCP endpoint is not configured. Please check your configuration.')
    }

    try {
      await this.initializeSession()
      // Wait a moment to ensure initialization is fully complete
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error) {
      throw error
    }
  }

  private async initializeSession(): Promise<void> {
    try {
      const requestBody = {
        jsonrpc: '2.0',
        id: 'init-session',
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: {},
            prompts: {},
            resources: {},
          },
          clientInfo: {
            name: 'quilt-catalog',
            version: '1.0.0',
          },
        },
      }

      // Add cache-busting parameter to avoid browser cache issues
      const url = `${this.baseUrl}?t=${Date.now()}`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: this.getAcceptHeader(),
        'Cache-Control': 'no-cache',
        'mcp-protocol-version': MCP_PROTOCOL_VERSION,
      }

      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers,
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const sessionIdFromHeaders = response.headers.get('mcp-session-id')

        const text = await response.text()
        let data: any = null

        // Debug logging (development only)
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 MCP Response Debug:', {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
            responseText: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
            responseLength: text.length,
          })
        }

        // Check if response is HTML (error page)
        if (
          text.trim().startsWith('<!doctype html>') ||
          text.trim().startsWith('<html>')
        ) {
          throw new Error(
            'MCP server is not available - received HTML response instead of JSON',
          )
        }

        // Parse SSE format first
        if (text.includes('event: message') && text.includes('data: ')) {
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                data = JSON.parse(line.substring(6))
                break
              } catch (e) {
                // Continue to next line
              }
            }
          }
        } else {
          // Try direct JSON parsing
          try {
            data = JSON.parse(text)
          } catch (e) {
            throw new Error(
              `Invalid response format - could not parse JSON: ${text.substring(0, 200)}...`,
            )
          }
        }

        console.log('🔍 Parsed MCP Data:', data)

        // Capture server information from the initialize response
        if (data?.result?.serverInfo) {
          this.serverInfo = {
            name: data.result.serverInfo.name,
            version: data.result.serverInfo.version,
          }
          console.log('✅ MCP Server Info captured:', this.serverInfo)
        }

        const sessionIdFromBody = data?.result?.sessionId
        const resolvedSessionId = sessionIdFromHeaders || sessionIdFromBody

        // For MCP protocol, session ID might not be required for initialization
        // Some MCP servers don't use session IDs, they're stateless
        if (resolvedSessionId) {
          this.sessionId = resolvedSessionId
          console.log('✅ MCP session established:', resolvedSessionId)
        } else {
          console.log('⚠️ No session ID provided by MCP server - using stateless mode')
          this.sessionId = `stateless-${Date.now()}` // Generate a temporary session ID
        }

        if (!data || !data.result) {
          console.log('❌ MCP Response Validation Failed:', {
            hasData: !!data,
            hasResult: !!(data && data.result),
            dataKeys: data ? Object.keys(data) : 'no data',
            fullData: data,
          })
          throw new Error(
            `Invalid response format - missing result: ${JSON.stringify(data)}`,
          )
        }

        // Send the required notifications/initialized method
        await this.sendInitializedNotification()
      } else {
        const errorText = await response.text().catch(() => '')
        if (errorText.includes('405 Not Allowed')) {
          throw new Error(
            'MCP server is not available - endpoint returned 405 Not Allowed',
          )
        }
        throw new Error(
          `Session initialization failed: ${response.status} ${response.statusText} - ${errorText}`,
        )
      }
    } catch (error) {
      throw error
    }
  }

  private async sendInitializedNotification(): Promise<void> {
    try {
      const url = `${this.baseUrl}?t=${Date.now()}`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: this.getAcceptHeader(),
        'Cache-Control': 'no-cache',
        'mcp-protocol-version': MCP_PROTOCOL_VERSION,
        'mcp-session-id': this.sessionId || '',
      }

      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {},
        }),
      })

      if (!response.ok) {
        // Log warning but don't throw - this is not critical
      }
    } catch (error) {
      // Log warning but don't throw - this is not critical
    }
  }

  async listAvailableTools(): Promise<MCPTool[]> {
    if (!this.sessionId) {
      await this.initialize()
    }

    const headers = await this.getHeaders()

    const url = `${this.baseUrl}?t=${Date.now()}`
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'list-tools',
        method: 'tools/list',
        params: {},
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      if (errorText.includes('405 Not Allowed')) {
        throw new Error('MCP server is not available - endpoint returned 405 Not Allowed')
      }
      throw new Error(
        `MCP tools/list failed with status ${response.status} ${response.statusText} - ${errorText}`,
      )
    }

    const text = await response.text()

    // Check if response is HTML (error page)
    if (text.trim().startsWith('<!doctype html>') || text.trim().startsWith('<html>')) {
      throw new Error(
        'MCP server is not available - received HTML response instead of JSON',
      )
    }

    const payload = this.parseResponsePayload(text)

    if (payload?.result?.tools) {
      return payload.result.tools as MCPTool[]
    }

    if (payload?.error) {
      throw new Error(payload.error.message || 'MCP tools/list returned an error')
    }

    return []
  }

  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.sessionId) {
      await this.initialize()
    }

    const headers = await this.getHeaders()

    const url = `${this.baseUrl}?t=${Date.now()}`
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `call-${toolCall.name}`,
        method: 'tools/call',
        params: {
          name: toolCall.name,
          arguments: toolCall.arguments ?? {},
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      if (errorText.includes('405 Not Allowed')) {
        throw new Error('MCP server is not available - endpoint returned 405 Not Allowed')
      }
      throw new Error(
        `MCP tools/call failed (${toolCall.name}): ${response.status} ${response.statusText} ${errorText}`,
      )
    }

    const text = await response.text()

    // Check if response is HTML (error page)
    if (text.trim().startsWith('<!doctype html>') || text.trim().startsWith('<html>')) {
      throw new Error(
        'MCP server is not available - received HTML response instead of JSON',
      )
    }

    const payload = this.parseResponsePayload(text)

    if (payload?.result) {
      return payload.result as MCPToolResult
    }

    if (payload?.error) {
      throw new Error(payload.error.message || 'MCP tools/call returned an error')
    }

    throw new Error('MCP tools/call returned an empty response')
  }

  getServerStatus(): 'connected' | 'disconnected' {
    return this.sessionId ? 'connected' : 'disconnected'
  }

  // Additional method required by DiagnosticTool.tsx and MCPContextProviderEnhanced.tsx
  async executeTool(
    name: string,
    args: Record<string, any> = {},
  ): Promise<MCPToolResult> {
    return this.callTool({
      name,
      arguments: args,
    })
  }

  disconnectFromServer(): void {
    this.sessionId = null
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connectToServer(_config?: MCPServerConfig): Promise<void> {
    return this.initialize()
  }

  hasSession(): boolean {
    return !!this.sessionId
  }

  async verifySSEEndpoint(): Promise<{
    endpoint: string
    reachable: boolean
    sseSupported: boolean
    mcpCompatible: boolean
    tools: number
    latency: number
    error?: string
  }> {
    const startTime = Date.now()
    const result: {
      endpoint: string
      reachable: boolean
      sseSupported: boolean
      mcpCompatible: boolean
      tools: number
      latency: number
      error?: string
    } = {
      endpoint: this.baseUrl,
      reachable: false,
      sseSupported: false,
      mcpCompatible: false,
      tools: 0,
      latency: 0,
    }

    try {
      console.log('🔍 Verifying SSE endpoint:', this.baseUrl)

      // Test SSE endpoint support directly
      console.log('Testing SSE endpoint support...')

      // Add cache-busting parameter like the working initializeSession method
      const url = `${this.baseUrl}?t=${Date.now()}`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: this.getAcceptHeader(),
        'Cache-Control': 'no-cache',
        'mcp-protocol-version': MCP_PROTOCOL_VERSION,
      }

      const sseResponse = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'sse-test',
          method: 'initialize',
          params: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: {}, prompts: {}, resources: {} },
            clientInfo: { name: 'sse-verification', version: '1.0.0' },
          },
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (sseResponse.ok) {
        result.reachable = true
        const contentType = sseResponse.headers.get('content-type')
        console.log('SSE response content-type:', contentType)

        if (contentType && contentType.includes('text/event-stream')) {
          result.sseSupported = true
          console.log('✅ SSE endpoint supported')
        } else {
          console.log('⚠️ Response not SSE format, content-type:', contentType)
        }

        // Test 3: MCP protocol compatibility
        const responseText = await sseResponse.text()
        console.log('SSE response preview:', `${responseText.substring(0, 200)}...`)

        try {
          // Check if response is HTML (error page)
          if (
            responseText.trim().startsWith('<!doctype html>') ||
            responseText.trim().startsWith('<html>')
          ) {
            throw new Error(
              'MCP server is not available - received HTML response instead of JSON',
            )
          }

          // Parse SSE format first (matching working initializeSession pattern)
          let mcpData = null
          if (
            responseText.includes('event: message') &&
            responseText.includes('data: ')
          ) {
            const lines = responseText.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  mcpData = JSON.parse(line.substring(6))
                  break
                } catch (e) {
                  // Continue to next line
                }
              }
            }
          } else {
            // Try direct JSON parsing
            try {
              mcpData = JSON.parse(responseText)
            } catch (e) {
              throw new Error(
                `Invalid response format - could not parse JSON: ${responseText.substring(0, 200)}...`,
              )
            }
          }

          if (mcpData && (mcpData.result || mcpData.error)) {
            result.mcpCompatible = true
            console.log('✅ MCP protocol compatible')
          } else {
            console.log('❌ MCP protocol incompatible, response:', mcpData)
            result.error = 'Invalid MCP response format'
          }
        } catch (parseError) {
          const errorMessage =
            parseError instanceof Error ? parseError.message : String(parseError)
          console.log('❌ Failed to parse MCP response:', parseError)
          result.error = `Parse error: ${errorMessage}`
        }
      } else {
        console.log(
          '❌ SSE endpoint test failed:',
          sseResponse.status,
          sseResponse.statusText,
        )
        result.error = `SSE test failed: ${sseResponse.status} ${sseResponse.statusText}`
      }

      // Test 4: Tools list (if MCP is compatible)
      if (result.mcpCompatible) {
        console.log('Testing tools list...')
        try {
          // Use same pattern as working methods
          const toolsUrl = `${this.baseUrl}?t=${Date.now()}`
          const toolsHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: this.getAcceptHeader(),
            'Cache-Control': 'no-cache',
            'mcp-protocol-version': MCP_PROTOCOL_VERSION,
          }

          const toolsResponse = await fetch(toolsUrl, {
            method: 'POST',
            mode: 'cors',
            headers: toolsHeaders,
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'tools-test',
              method: 'tools/list',
              params: {},
            }),
            signal: AbortSignal.timeout(10000),
          })

          if (toolsResponse.ok) {
            const toolsText = await toolsResponse.text()
            let toolsData = null

            // Parse SSE format first (matching working pattern)
            if (toolsText.includes('event: message') && toolsText.includes('data: ')) {
              const lines = toolsText.split('\n')
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    toolsData = JSON.parse(line.substring(6))
                    break
                  } catch (e) {
                    // Continue to next line
                  }
                }
              }
            } else {
              // Try direct JSON parsing
              try {
                toolsData = JSON.parse(toolsText)
              } catch (e) {
                console.log('❌ Failed to parse tools response JSON:', e)
              }
            }

            if (toolsData && toolsData.result && toolsData.result.tools) {
              result.tools = toolsData.result.tools.length
              console.log(`✅ Found ${result.tools} tools`)
            } else {
              console.log('❌ No tools found in response:', toolsData)
            }
          } else {
            console.log(
              '❌ Tools list failed:',
              toolsResponse.status,
              toolsResponse.statusText,
            )
          }
        } catch (toolsError) {
          console.log('❌ Tools list error:', toolsError)
        }
      }
    } catch (error) {
      console.log('❌ SSE verification error:', error)
      result.error = error instanceof Error ? error.message : String(error)
    }

    result.latency = Date.now() - startTime
    return result
  }

  private parseResponsePayload(body: string): any {
    if (!body) return null

    if (body.startsWith('event:')) {
      const lines = body.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            return JSON.parse(line.slice(6))
          } catch (error) {
            // continue scanning for a valid data line
          }
        }
      }
      return null
    }

    try {
      return JSON.parse(body)
    } catch (error) {
      return null
    }
  }

  // OAuth 2.1 Implementation
  async discoverOAuth(): Promise<OAuthDiscovery | null> {
    try {
      const oauthUrl = `${this.baseUrl.replace('/mcp/', '/oauth/')}.well-known/oauth-authorization-server`
      const response = await fetch(oauthUrl, {
        method: 'GET',
        mode: 'cors',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
      })

      if (response.ok) {
        const discovery = (await response.json()) as OAuthDiscovery
        this.oauthDiscovery = discovery
        console.log('✅ OAuth discovery successful:', discovery)
        return discovery
      } else {
        console.log('⚠️ OAuth discovery failed:', response.status, response.statusText)
        return null
      }
    } catch (error) {
      console.log('⚠️ OAuth discovery error:', error)
      return null
    }
  }

  async startOAuthFlow(): Promise<string> {
    if (!this.oauthDiscovery) {
      const discovery = await this.discoverOAuth()
      if (!discovery) {
        throw new Error('OAuth discovery failed - cannot start OAuth flow')
      }
    }

    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = await this.generateCodeChallenge(codeVerifier)
    const state = this.generateState()

    // Store auth state for callback verification
    this.oauthAuthState = {
      codeVerifier,
      state,
      redirectUri: `${window.location.origin}/oauth/callback`,
    }

    // Build authorization URL
    const authUrl = new URL(this.oauthDiscovery!.authorization_endpoint)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', 'quilt-catalog') // TODO: Get from config
    authUrl.searchParams.set('redirect_uri', this.oauthAuthState.redirectUri)
    authUrl.searchParams.set('scope', 'openid profile email quilt:read quilt:write')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    console.log('🔐 Starting OAuth flow:', authUrl.toString())
    return authUrl.toString()
  }

  async handleOAuthCallback(code: string, state: string): Promise<OAuthToken> {
    if (!this.oauthAuthState) {
      throw new Error('No OAuth state found - cannot handle callback')
    }

    if (state !== this.oauthAuthState.state) {
      throw new Error('Invalid state parameter - possible CSRF attack')
    }

    if (!this.oauthDiscovery) {
      throw new Error('OAuth discovery not available')
    }

    const tokenResponse = await fetch(this.oauthDiscovery.token_endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'quilt-catalog', // TODO: Get from config
        code,
        redirect_uri: this.oauthAuthState.redirectUri,
        code_verifier: this.oauthAuthState.codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`)
    }

    const tokenData = (await tokenResponse.json()) as OAuthToken
    tokenData.expires_at = Date.now() + tokenData.expires_in * 1000
    this.oauthToken = tokenData

    // Clear auth state
    this.oauthAuthState = null

    console.log('✅ OAuth token received:', { expires_at: tokenData.expires_at })
    return tokenData
  }

  async refreshToken(): Promise<OAuthToken> {
    if (!this.oauthToken?.refresh_token || !this.oauthDiscovery) {
      throw new Error('No refresh token available')
    }

    const tokenResponse = await fetch(this.oauthDiscovery.token_endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'quilt-catalog', // TODO: Get from config
        refresh_token: this.oauthToken.refresh_token,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      throw new Error(`Token refresh failed: ${tokenResponse.status} ${errorText}`)
    }

    const tokenData = (await tokenResponse.json()) as OAuthToken
    tokenData.expires_at = Date.now() + tokenData.expires_in * 1000
    this.oauthToken = tokenData

    console.log('✅ OAuth token refreshed:', { expires_at: tokenData.expires_at })
    return tokenData
  }

  async getAccessToken(): Promise<string | null> {
    // First try to get token from Redux store (automatic)
    try {
      const reduxToken = await this.getReduxAccessToken()
      if (reduxToken) {
        return reduxToken
      }
    } catch (error) {
      console.warn('⚠️ Failed to get Redux token, falling back to OAuth:', error)
    }

    // Fallback to OAuth token if Redux token not available
    if (!this.oauthToken) {
      return null
    }

    // Check if OAuth token is expired
    if (this.oauthToken.expires_at && Date.now() >= this.oauthToken.expires_at) {
      try {
        await this.refreshToken()
      } catch (error) {
        console.error('❌ Token refresh failed:', error)
        this.logout()
        return null
      }
    }

    return this.oauthToken.access_token
  }

  private async getReduxAccessToken(): Promise<string | null> {
    if (this.reduxTokenGetter) {
      try {
        console.log('🔍 Attempting to get Redux token...')
        const token = await this.reduxTokenGetter()
        console.log('🔍 Redux token result:', token ? 'Token found' : 'No token')
        return token
      } catch (error) {
        console.error('❌ Redux token getter error:', error)
        return null
      }
    } else {
      console.log('⚠️ No Redux token getter set')
      return null
    }
  }

  /**
   * Set the Redux token getter function
   * This should be called by MCPContextProvider which has access to Redux store
   */
  setReduxTokenGetter(getter: () => Promise<string | null>): void {
    this.reduxTokenGetter = getter
  }

  isAuthenticated(): boolean {
    // For synchronous check, only check OAuth token
    // Redux token check is handled asynchronously in getAccessToken()
    return this.oauthToken !== null
  }

  async isAuthenticatedAsync(): Promise<boolean> {
    // Check if we have a valid Redux token
    try {
      const reduxToken = await this.getReduxAccessToken()
      if (reduxToken) {
        return true
      }
    } catch (error) {
      // Ignore Redux token errors, check OAuth token
    }

    // Fallback to OAuth token check
    return this.oauthToken !== null
  }

  logout(): void {
    this.oauthToken = null
    this.oauthAuthState = null
    this.oauthDiscovery = null
    console.log('🔐 OAuth logout completed')
  }

  // OAuth utility methods
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  private generateState(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
}

export const mcpClient = new QuiltMCPClient()
