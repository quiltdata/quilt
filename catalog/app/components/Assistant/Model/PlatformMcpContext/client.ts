/**
 * Thin MCP client for stateless streamable-http.
 *
 * Implements the minimum protocol surface we need:
 * - `initialize` (one-time handshake)
 * - `tools/list` / `tools/call`
 * - `resources/list` / `resources/read`
 *
 * Each call is an independent HTTP POST. With `stateless_http=True` on the
 * server we don't persist a session; we include the current bearer token on
 * every request (fetched lazily via `getToken`).
 *
 * We don't use `@modelcontextprotocol/sdk` because browser is not officially
 * supported (README lists Node/Bun/Deno only) and the protocol over stateless
 * HTTP is trivial enough to implement directly. Roughly one JSON-RPC envelope.
 */

const PROTOCOL_VERSION = '2025-06-18'
const CLIENT_INFO = { name: 'quilt-catalog', version: '1' } as const

export interface McpToolDescriptor {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export interface McpContentText {
  type: 'text'
  text: string
}

export interface McpContentImage {
  type: 'image'
  data: string // base64
  mimeType: string
}

export interface McpContentResource {
  type: 'resource'
  resource: {
    uri: string
    text?: string
    mimeType?: string
  }
}

export type McpContent =
  | McpContentText
  | McpContentImage
  | McpContentResource
  | { type: string }

export interface McpToolResult {
  content: McpContent[]
  isError?: boolean
}

export interface McpResourceContents {
  contents: Array<{ uri: string; text?: string; mimeType?: string }>
}

export class McpError extends Error {
  constructor(
    message: string,
    readonly data?: unknown,
  ) {
    super(message)
    this.name = 'McpError'
  }
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: unknown
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: { code: number; message: string; data?: unknown }
}

export interface McpClientOptions {
  url: string
  getToken: () => string | null
}

/**
 * Minimal MCP client for the streamable-http transport.
 *
 * Not thread-safe across overlapping in-flight requests — the id counter is
 * monotonic and requests aren't multiplexed over one connection. In practice
 * the LLM serializes tool calls per turn, so this is fine.
 */
export class McpClient {
  private id = 0

  constructor(private readonly options: McpClientOptions) {}

  async initialize(): Promise<void> {
    await this.rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    })
    // Server MUST receive an `initialized` notification after initialize.
    await this.notify('notifications/initialized')
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    const result = await this.rpc<{ tools: McpToolDescriptor[] }>('tools/list')
    return result.tools
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    return this.rpc<McpToolResult>('tools/call', { name, arguments: args })
  }

  async readResource(uri: string): Promise<McpResourceContents> {
    return this.rpc<McpResourceContents>('resources/read', { uri })
  }

  private async rpc<T>(method: string, params?: unknown): Promise<T> {
    const id = ++this.id
    const payload: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }
    const body = await this.post(payload)
    if (body === null) {
      throw new McpError(`MCP ${method}: empty response`)
    }
    if (body.error) {
      throw new McpError(body.error.message, body.error.data)
    }
    return body.result as T
  }

  private async notify(method: string, params?: unknown): Promise<void> {
    // JSON-RPC notifications omit `id`.
    await this.post({ jsonrpc: '2.0', method, params } as Omit<JsonRpcRequest, 'id'>)
  }

  private async post(
    payload: JsonRpcRequest | Omit<JsonRpcRequest, 'id'>,
  ): Promise<JsonRpcResponse | null> {
    const token = this.options.getToken()
    if (!token) throw new McpError('MCP: no session token')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    }

    const resp = await fetch(this.options.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      throw new McpError(`MCP: HTTP ${resp.status} ${resp.statusText}`)
    }

    // Notifications get a 202 Accepted with no body.
    if (resp.status === 202) return null

    const contentType = resp.headers.get('content-type') ?? ''
    if (contentType.includes('text/event-stream')) {
      return this.parseEventStream(resp)
    }
    if (contentType.includes('application/json')) {
      return (await resp.json()) as JsonRpcResponse
    }
    throw new McpError(`MCP: unexpected content-type: ${contentType}`)
  }

  /**
   * Parse a one-shot SSE response. FastMCP with `stateless_http=True` returns
   * a single `message` event with the JSON-RPC body, then closes the stream.
   */
  private async parseEventStream(resp: Response): Promise<JsonRpcResponse | null> {
    const reader = resp.body?.getReader()
    if (!reader) throw new McpError('MCP: SSE response had no body')
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (value) buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split('\n\n')
      // Keep the (possibly partial) last chunk in the buffer.
      buffer = chunks.pop() ?? ''
      for (const chunk of chunks) {
        const dataLines = chunk
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
        if (!dataLines.length) continue
        const data = dataLines.join('\n')
        reader.cancel().catch(() => {})
        return JSON.parse(data) as JsonRpcResponse
      }
      if (done) break
    }
    return null
  }
}
