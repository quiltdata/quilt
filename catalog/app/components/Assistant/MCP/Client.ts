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
} from './types'

const MCP_PROTOCOL_VERSION = '2024-11-05'

export class QuiltMCPClient implements MCPClient {
  private baseUrl: string

  private isSSEEndpoint: boolean

  private sessionId: string | null = null

  constructor() {
    // Use configuration-based URL selection
    if (cfg.mcpEndpoint && cfg.mcpEndpoint.trim() !== '') {
      this.baseUrl = cfg.mcpEndpoint.endsWith('/')
        ? cfg.mcpEndpoint
        : `${cfg.mcpEndpoint}/`

      // Detect if this is an SSE endpoint
      this.isSSEEndpoint = this.detectSSEEndpoint(cfg.mcpEndpoint)
    } else {
      this.baseUrl = 'http://localhost:8000/mcp/'
      this.isSSEEndpoint = false
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

  async initialize(): Promise<void> {
    if (this.sessionId) return

    // Check if MCP endpoint is configured
    if (!cfg.mcpEndpoint || cfg.mcpEndpoint.trim() === '') {
      throw new Error('MCP endpoint is not configured. Please check your configuration.')
    }

    try {
      await this.initializeSession()
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: this.getAcceptHeader(),
      'Cache-Control': 'no-cache',
      'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    }

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId
    }

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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: this.getAcceptHeader(),
      'Cache-Control': 'no-cache',
      'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    }

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId
    }

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
}

export const mcpClient = new QuiltMCPClient()
