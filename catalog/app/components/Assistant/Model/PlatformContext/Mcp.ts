/**
 * Platform MCP — wire protocol + Qurator bridge.
 *
 * Collapses what was `client.ts` + `bridge.ts`. Effect-native throughout:
 * - `tryPromise` with the fetch AbortSignal — interruption cancels in-flight
 *   requests when the owning fiber is killed.
 * - Tagged errors via `Data.TaggedError` — catchable by kind.
 * - Pure content mapping, testable by supplying a stub `McpClient` record.
 *
 * Not using `@modelcontextprotocol/sdk`: the SDK lists Node/Bun/Deno only as
 * supported runtimes, assumes stateful sessions with an SSE GET channel, and
 * would pull in `zod` + OAuth machinery we don't use. Our server runs FastMCP
 * with `stateless_http=True`; each call is an independent POST carrying the
 * bearer. The protocol surface we need fits in this file.
 */

import * as Eff from 'effect'

import * as XML from 'utils/XML'

import * as Content from '../Content'
import * as Tool from '../Tool'

const PROTOCOL_VERSION = '2025-06-18'
const CLIENT_INFO = { name: 'quilt-catalog', version: '1' } as const

// ---------------------------------------------------------------------------
// Types (wire + tool)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/*
 * Errors are plain classes with a `_tag` discriminator rather than
 * `Eff.Data.TaggedError` — catalog's babel class-transform chokes on extending
 * a runtime-produced class (`Class constructor Base cannot be invoked without
 * 'new'`). `Effect.catchTags` only inspects `_tag`, so this is a drop-in.
 */

export class McpAuthError {
  readonly _tag = 'McpAuthError'

  get message() {
    return 'MCP: no session token'
  }
}

export class McpTransportError {
  readonly _tag = 'McpTransportError'

  readonly detail: string

  readonly status?: number

  constructor(props: { detail: string; status?: number }) {
    this.detail = props.detail
    this.status = props.status
  }

  get message() {
    return this.status
      ? `MCP transport: HTTP ${this.status} — ${this.detail}`
      : `MCP transport: ${this.detail}`
  }
}

export class McpProtocolError {
  readonly _tag = 'McpProtocolError'

  readonly detail: string

  constructor(props: { detail: string }) {
    this.detail = props.detail
  }

  get message() {
    return `MCP protocol: ${this.detail}`
  }
}

export class McpRpcError {
  readonly _tag = 'McpRpcError'

  readonly code: number

  readonly rpcMessage: string

  readonly data?: unknown

  constructor(props: { code: number; rpcMessage: string; data?: unknown }) {
    this.code = props.code
    this.rpcMessage = props.rpcMessage
    this.data = props.data
  }

  get message() {
    return `MCP rpc ${this.code}: ${this.rpcMessage}`
  }
}

export type McpError = McpAuthError | McpTransportError | McpProtocolError | McpRpcError

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface McpClientOptions {
  url: string
  getToken: () => string | null
}

export interface McpClient {
  initialize: () => Eff.Effect.Effect<void, McpError>
  listTools: () => Eff.Effect.Effect<McpToolDescriptor[], McpError>
  callTool: (
    name: string,
    args: Record<string, unknown>,
  ) => Eff.Effect.Effect<McpToolResult, McpError>
  readResource: (uri: string) => Eff.Effect.Effect<McpResourceContents, McpError>
}

export function make(options: McpClientOptions): McpClient {
  // JS is single-threaded; distinct values for concurrent callers are
  // guaranteed by synchronous increment-before-await.
  let nextId = 0

  const post = (
    payload: JsonRpcRequest | Omit<JsonRpcRequest, 'id'>,
  ): Eff.Effect.Effect<JsonRpcResponse | null, McpError> =>
    Eff.Effect.gen(function* () {
      const token = options.getToken()
      if (!token) return yield* Eff.Effect.fail(new McpAuthError())

      const resp = yield* Eff.Effect.tryPromise({
        try: (signal) =>
          fetch(options.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json, text/event-stream',
              Authorization: `Bearer ${token}`,
              'MCP-Protocol-Version': PROTOCOL_VERSION,
            },
            body: JSON.stringify(payload),
            signal,
          }),
        catch: (e) => new McpTransportError({ detail: String(e) }),
      })

      if (!resp.ok) {
        return yield* Eff.Effect.fail(
          new McpTransportError({ detail: resp.statusText, status: resp.status }),
        )
      }

      // Notifications get 202 Accepted with no body.
      if (resp.status === 202) return null

      const contentType = resp.headers.get('content-type') ?? ''
      if (contentType.includes('text/event-stream')) {
        return yield* parseEventStream(resp)
      }
      if (contentType.includes('application/json')) {
        return yield* Eff.Effect.tryPromise({
          try: () => resp.json() as Promise<JsonRpcResponse>,
          catch: (e) => new McpProtocolError({ detail: `bad JSON: ${e}` }),
        })
      }
      return yield* Eff.Effect.fail(
        new McpProtocolError({ detail: `unexpected content-type: ${contentType}` }),
      )
    })

  const rpc = <T>(method: string, params?: unknown): Eff.Effect.Effect<T, McpError> =>
    Eff.Effect.gen(function* () {
      const id = ++nextId
      const body = yield* post({ jsonrpc: '2.0', id, method, params })
      if (body === null) {
        return yield* Eff.Effect.fail(
          new McpProtocolError({ detail: `${method}: empty response` }),
        )
      }
      if (body.error) {
        return yield* Eff.Effect.fail(
          new McpRpcError({
            code: body.error.code,
            rpcMessage: body.error.message,
            data: body.error.data,
          }),
        )
      }
      return body.result as T
    })

  const notify = (method: string, params?: unknown): Eff.Effect.Effect<void, McpError> =>
    // JSON-RPC notifications omit `id` and get 202 back (post returns null).
    post({ jsonrpc: '2.0', method, params } as Omit<JsonRpcRequest, 'id'>).pipe(
      Eff.Effect.asVoid,
    )

  return {
    initialize: () =>
      Eff.Effect.gen(function* () {
        yield* rpc('initialize', {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: CLIENT_INFO,
        })
        // Server MUST receive `initialized` after `initialize`.
        yield* notify('notifications/initialized')
      }),
    listTools: () =>
      rpc<{ tools: McpToolDescriptor[] }>('tools/list').pipe(
        Eff.Effect.map((r) => r.tools),
      ),
    callTool: (name, args) => rpc<McpToolResult>('tools/call', { name, arguments: args }),
    readResource: (uri) => rpc<McpResourceContents>('resources/read', { uri }),
  }
}

/**
 * Parse a one-shot SSE response into a single JSON-RPC envelope. FastMCP with
 * `stateless_http=True` emits one `message` event with the body and closes.
 * Fiber interruption aborts the underlying fetch; the reader unwinds via the
 * stream being cancelled.
 */
function parseEventStream(
  resp: Response,
): Eff.Effect.Effect<JsonRpcResponse | null, McpError> {
  return Eff.Effect.tryPromise({
    try: async () => {
      const reader = resp.body?.getReader()
      if (!reader) throw new Error('SSE response had no body')
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (value) buffer += decoder.decode(value, { stream: true })
        // SSE events may be separated by `\n\n` or `\r\n\r\n` — FastMCP emits
        // the CRLF form. Normalize before splitting.
        const chunks = buffer.replace(/\r\n/g, '\n').split('\n\n')
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
        if (done) return null
      }
    },
    catch: (e) => new McpProtocolError({ detail: `SSE parse: ${e}` }),
  })
}

// ---------------------------------------------------------------------------
// Bridge to Qurator tool model
// ---------------------------------------------------------------------------

const IMAGE_MIME_MAP: Record<string, Content.ImageFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/**
 * Permissive Effect schema for MCP tool inputs.
 *
 * The MCP server's JSON Schema (sent to Bedrock as the tool's `inputSchema`)
 * is authoritative. Server-side validation happens in FastMCP + Pydantic. We
 * don't try to decode inputs client-side — just pass them through.
 */
const AnyRecord = Eff.Schema.Record({
  key: Eff.Schema.String,
  value: Eff.Schema.Unknown,
})

export function mapContent(block: McpContent): Content.ToolResultContentBlock {
  if (block.type === 'text' && typeof (block as McpContentText).text === 'string') {
    return Content.ToolResultContentBlock.Text({
      text: (block as McpContentText).text,
    })
  }
  if (block.type === 'image') {
    const img = block as McpContentImage
    const format = IMAGE_MIME_MAP[img.mimeType?.toLowerCase()]
    if (format) {
      return Content.ToolResultContentBlock.Image({ format, source: img.data })
    }
    return Content.ToolResultContentBlock.Text({
      text: `[image: ${img.mimeType ?? 'unknown'} — ${img.data.length} base64 chars]`,
    })
  }
  if (block.type === 'resource') {
    const res = block as McpContentResource
    const text = res.resource.text ?? `[resource: ${res.resource.uri}]`
    return Content.ToolResultContentBlock.Text({ text })
  }
  // Unknown future content type — dump JSON so the LLM has something to read.
  return Content.ToolResultContentBlock.Text({
    text: `[unknown content block]\n${JSON.stringify(block)}`,
  })
}

function makeExecutor(
  client: McpClient,
  mcpName: string,
): Tool.Executor<Record<string, unknown>> {
  return (args) =>
    client.callTool(mcpName, args).pipe(
      Eff.Effect.map((result) => {
        const content = result.content.map(mapContent)
        return result.isError ? Tool.fail(...content) : Tool.succeed(...content)
      }),
      Eff.Effect.catchAll((err) =>
        Eff.Effect.succeed(
          Tool.fail(
            Content.ToolResultContentBlock.Text({
              text: `${mcpName}: ${err.message}`,
            }),
          ),
        ),
      ),
      Eff.Effect.map(Eff.Option.some),
    )
}

/**
 * Build a Qurator `Tool.Descriptor` from an MCP tool.
 *
 * We bypass `Tool.make()` because it runs Effect-Schema decoding over the
 * inputs — the JSON Schema from the server is authoritative for Bedrock, and
 * server-side FastMCP + Pydantic validates the actual call. We construct the
 * descriptor directly: permissive Effect schema for the type wrapper, the
 * MCP server's JSON Schema for Bedrock's tool config.
 */
export function buildTool(
  client: McpClient,
  mcp: McpToolDescriptor,
): Tool.Descriptor<Record<string, unknown>> {
  const effectJsonSchema = Tool.makeJSONSchema(AnyRecord)
  const schema = {
    ...effectJsonSchema,
    ...mcp.inputSchema,
    description: mcp.description ?? effectJsonSchema.description,
  }
  return {
    description: mcp.description,
    schema,
    executor: makeExecutor(client, mcp.name),
  }
}

// ---------------------------------------------------------------------------
// Session bootstrap
// ---------------------------------------------------------------------------

export interface McpContextState {
  status: 'loading' | 'ready' | 'error'
  error?: McpError
  tools: Tool.Collection
  messages: string[]
}

export const INITIAL_STATE: McpContextState = {
  status: 'loading',
  tools: {},
  messages: [],
}

const SEARCH_SYNTAX_URI = 'quilt-platform://search_syntax'

/**
 * Fetch tools and optional resource context from PMS. Never fails — surfaces
 * errors through the returned state so the UI can render regardless.
 */
export function loadContext(
  client: McpClient,
): Eff.Effect.Effect<McpContextState, never> {
  const searchSyntaxMessages = client.readResource(SEARCH_SYNTAX_URI).pipe(
    Eff.Effect.map((syntax) => {
      const text = syntax.contents
        .map((c) => c.text ?? '')
        .join('\n')
        .trim()
      return text ? [XML.tag('platform-mcp-search-syntax', {}, text).toString()] : []
    }),
    Eff.Effect.catchAll(() => Eff.Effect.succeed<string[]>([])),
  )

  return Eff.Effect.gen(function* () {
    yield* client.initialize()
    const mcpTools = yield* client.listTools()
    const tools: Tool.Collection = {}
    for (const t of mcpTools) {
      tools[`mcp__platform__${t.name}`] = buildTool(client, t)
    }
    const messages = yield* searchSyntaxMessages
    return { status: 'ready' as const, tools, messages }
  }).pipe(
    Eff.Effect.catchAll((error) =>
      Eff.Effect.succeed<McpContextState>({
        status: 'error',
        error,
        tools: {},
        messages: [],
      }),
    ),
  )
}
