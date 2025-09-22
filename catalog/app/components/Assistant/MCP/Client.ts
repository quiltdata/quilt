/**
 * MCP Client - Real Server Connection
 */

import cfg from 'constants/config'

const MCP_PROTOCOL_VERSION = '2024-11-05'

export class QuiltMCPClient {
  private baseUrl: string

  private sessionId: string | null = null

  constructor() {
    // Use configuration-based URL selection
    if (cfg.mcpEndpoint) {
      this.baseUrl = cfg.mcpEndpoint.endsWith('/')
        ? cfg.mcpEndpoint
        : `${cfg.mcpEndpoint}/`
    } else {
      this.baseUrl = 'http://localhost:8001/mcp/'
    }
  }

  async initialize(): Promise<void> {
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

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Cache-Control': 'no-cache',
          'mcp-protocol-version': MCP_PROTOCOL_VERSION,
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const text = await response.text()
        let data: any = null

        // Parse SSE format first
        if (text.startsWith('event: message\ndata: ')) {
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
            // Handle other formats if needed
          }
        }

        if (data && data.result) {
          // Check if the server provided a session ID in the response body
          if (data.result.sessionId) {
            this.sessionId = data.result.sessionId
          } else {
            // Generate client-side session ID if server doesn't provide one
            this.sessionId = this.generateSessionId()
          }

          // Send the required notifications/initialized method
          await this.sendInitializedNotification()
        } else {
          throw new Error('Invalid response format')
        }
      } else {
        throw new Error(`Session initialization failed: ${response.status}`)
      }
    } catch (error) {
      throw error
    }
  }

  private async sendInitializedNotification(): Promise<void> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Cache-Control': 'no-cache',
          'mcp-protocol-version': MCP_PROTOCOL_VERSION,
          'mcp-session-id': this.sessionId || '',
        },
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

  async listAvailableTools(): Promise<any[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Cache-Control': 'no-cache',
        'mcp-protocol-version': MCP_PROTOCOL_VERSION,
      }

      if (this.sessionId) {
        headers['mcp-session-id'] = this.sessionId
      }

      const requestBody = {
        jsonrpc: '2.0',
        id: 'load-tools',
        method: 'tools/list',
        params: {},
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        mode: 'cors',
        headers,
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const text = await response.text()
        let data: any = null

        // Parse SSE format first
        if (text.startsWith('event: message\ndata: ')) {
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
            // Handle other formats if needed
          }
        }

        if (data && data.result && data.result.tools) {
          return data.result.tools
        } else if (data && data.error) {
          // If we get "Invalid request parameters", try alternative approaches
          if (data.error.message === 'Invalid request parameters') {
            // Try without session ID
            try {
              const altResponse = await fetch(this.baseUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json, text/event-stream',
                  'Cache-Control': 'no-cache',
                  'mcp-protocol-version': MCP_PROTOCOL_VERSION,
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 'load-tools-alt',
                  method: 'tools/list',
                  params: {},
                }),
              })

              if (altResponse.ok) {
                const altText = await altResponse.text()
                let altData: any = null
                if (altText.startsWith('event: message\ndata: ')) {
                  const lines = altText.split('\n')
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      try {
                        altData = JSON.parse(line.substring(6))
                        break
                      } catch (e) {
                        // Continue
                      }
                    }
                  }
                } else {
                  try {
                    altData = JSON.parse(altText)
                  } catch (e) {
                    // Continue
                  }
                }

                if (altData && altData.result && altData.result.tools) {
                  return altData.result.tools
                }
              }
            } catch (altError) {
              // Continue
            }
          }

          return []
        } else {
          return []
        }
      } else {
        return []
      }
    } catch (error) {
      return []
    }
  }

  async callTool(toolName: string, parameters: any): Promise<any> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Cache-Control': 'no-cache',
        'mcp-protocol-version': MCP_PROTOCOL_VERSION,
      }

      if (this.sessionId) {
        headers['mcp-session-id'] = this.sessionId
      }

      const requestBody = {
        jsonrpc: '2.0',
        id: `call-${toolName}`,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: parameters,
        },
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        mode: 'cors',
        headers,
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const text = await response.text()
        let data: any = null

        // Parse SSE format first
        if (text.startsWith('event: message\ndata: ')) {
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
            // Handle other formats if needed
          }
        }

        if (data && data.result) {
          return data.result
        } else if (data && data.error) {
          throw new Error(data.error.message || 'Tool call failed')
        } else {
          throw new Error('Invalid response format')
        }
      } else {
        throw new Error(`Tool call failed: ${response.status}`)
      }
    } catch (error) {
      throw error
    }
  }

  private generateSessionId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    )
  }

  getServerStatus(): string {
    return this.sessionId ? 'connected' : 'disconnected'
  }

  disconnectFromServer(): void {
    this.sessionId = null
  }

  connectToServer(): Promise<void> {
    return this.initialize()
  }
}

export const mcpClient = new QuiltMCPClient()
