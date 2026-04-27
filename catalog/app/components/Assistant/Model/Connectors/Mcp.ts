/**
 * Platform MCP — wire protocol + Qurator bridge.
 *
 * Effect-native throughout:
 * - Transport: `@effect/platform`'s `HttpClient` with the
 *   `FetchHttpClient` layer. Cancellation via fiber interrupt aborts the
 *   underlying fetch.
 * - Wire validation: `Eff.Schema` decoders at every response boundary.
 *   Unknown content types fall through to a permissive schema (forward-
 *   compat) rather than failing — `mapContent` still renders them as
 *   text for the LLM.
 * - Tagged errors via `_tag` discriminator (plain classes — see ES5
 *   note on error block) so `Effect.catchTags` can match by kind.
 *
 * Not using `@modelcontextprotocol/sdk`: the SDK lists Node/Bun/Deno only as
 * supported runtimes, assumes stateful sessions with an SSE GET channel, and
 * would pull in `zod` + OAuth machinery we don't use. Our server runs FastMCP
 * with `stateless_http=True`; each call is an independent POST carrying the
 * bearer. The protocol surface we need fits in this file.
 */

import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpClientRequest from '@effect/platform/HttpClientRequest'
import * as Eff from 'effect'
import * as uuid from 'uuid'

import * as Content from '../Content'

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
  id: string
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
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
// Wire schemas (runtime validation at the response boundary)
// ---------------------------------------------------------------------------

const McpContentTextSchema = Eff.Schema.Struct({
  type: Eff.Schema.Literal('text'),
  text: Eff.Schema.String,
})

const McpContentImageSchema = Eff.Schema.Struct({
  type: Eff.Schema.Literal('image'),
  data: Eff.Schema.String,
  mimeType: Eff.Schema.String,
})

const McpContentResourceSchema = Eff.Schema.Struct({
  type: Eff.Schema.Literal('resource'),
  resource: Eff.Schema.Struct({
    uri: Eff.Schema.String,
    text: Eff.Schema.optional(Eff.Schema.String),
    mimeType: Eff.Schema.optional(Eff.Schema.String),
  }),
})

/*
 * Forward-compat fallback for content blocks whose `type` we don't yet
 * recognize. Permissive on extra fields so a future `type: 'video'` (or
 * malformed known type) decodes as `{ type: <string> }` and `mapContent`
 * renders its JSON for the LLM rather than failing the whole response.
 */
const McpContentUnknownSchema = Eff.Schema.Struct({
  type: Eff.Schema.String,
})

const McpContentSchema = Eff.Schema.Union(
  McpContentTextSchema,
  McpContentImageSchema,
  McpContentResourceSchema,
  McpContentUnknownSchema,
)

const McpToolDescriptorSchema = Eff.Schema.Struct({
  name: Eff.Schema.String,
  description: Eff.Schema.optional(Eff.Schema.String),
  inputSchema: Eff.Schema.Record({
    key: Eff.Schema.String,
    value: Eff.Schema.Unknown,
  }),
})

const ToolsListResponseSchema = Eff.Schema.Struct({
  tools: Eff.Schema.Array(McpToolDescriptorSchema),
})

const McpToolResultSchema = Eff.Schema.Struct({
  content: Eff.Schema.Array(McpContentSchema),
  isError: Eff.Schema.optional(Eff.Schema.Boolean),
})

const McpResourceContentsSchema = Eff.Schema.Struct({
  contents: Eff.Schema.Array(
    Eff.Schema.Struct({
      uri: Eff.Schema.String,
      text: Eff.Schema.optional(Eff.Schema.String),
      mimeType: Eff.Schema.optional(Eff.Schema.String),
    }),
  ),
})

const JsonRpcResponseSchema = Eff.Schema.Struct({
  jsonrpc: Eff.Schema.Literal('2.0'),
  id: Eff.Schema.Union(Eff.Schema.String, Eff.Schema.Number),
  result: Eff.Schema.optional(Eff.Schema.Unknown),
  error: Eff.Schema.optional(
    Eff.Schema.Struct({
      code: Eff.Schema.Number,
      message: Eff.Schema.String,
      data: Eff.Schema.optional(Eff.Schema.Unknown),
    }),
  ),
})

const decodeWith =
  <A, I>(schema: Eff.Schema.Schema<A, I>, label: string) =>
  (input: unknown): Eff.Effect.Effect<A, McpProtocolError> =>
    Eff.Schema.decodeUnknown(schema)(input).pipe(
      Eff.Effect.mapError(
        (err) => new McpProtocolError({ detail: `${label}: ${String(err)}` }),
      ),
    )

// ---------------------------------------------------------------------------
// SSE parsing
// ---------------------------------------------------------------------------

/**
 * Parse a buffered SSE response body and return the JSON payload of the
 * first event with `data:` lines. FastMCP with `stateless_http=True` emits
 * exactly one `message` event per response and closes. Returns `null` if
 * the body has no data events (notification-style 200 with empty stream).
 *
 * SSE separates events with a blank line — `\n\n` per spec, but FastMCP
 * emits the CRLF form (`\r\n\r\n`). Normalize before splitting.
 */
export function parseSseToJson(text: string): unknown | null {
  const events = text.replace(/\r\n/g, '\n').split('\n\n')
  for (const event of events) {
    const dataLines = event
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
    if (!dataLines.length) continue
    return JSON.parse(dataLines.join('\n'))
  }
  return null
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface McpClientOptions {
  url: string
  /**
   * Resolve the bearer token effectfully. Returning `McpAuthError` short-
   * circuits the request without firing a fetch. The token is read fresh on
   * every call — callers can close over a redux store and project the
   * current token via a memoized selector.
   */
  getToken: () => Eff.Effect.Effect<string, McpAuthError>
}

export interface McpClient {
  initialize: () => Eff.Effect.Effect<void, McpError>
  listTools: () => Eff.Effect.Effect<McpToolDescriptor[], McpError>
  callTool: (
    name: string,
    args: Record<string, unknown>,
  ) => Eff.Effect.Effect<McpToolResult, McpError>
  readResource: (uri: string) => Eff.Effect.Effect<McpResourceContents, McpError>
  /**
   * MCP base protocol `ping` — JSON-RPC method returning an empty
   * object on success. Connectors uses this as a transport-health probe
   * (D24); independent POST in stateless HTTP mode, no session state.
   */
  ping: () => Eff.Effect.Effect<void, McpError>
}

export function make(options: McpClientOptions): McpClient {
  const post = (
    payload: JsonRpcRequest | Omit<JsonRpcRequest, 'id'>,
  ): Eff.Effect.Effect<JsonRpcResponse | null, McpError> =>
    Eff.Effect.gen(function* () {
      const token = yield* options.getToken()
      const httpClient = yield* HttpClient.HttpClient

      const request = HttpClientRequest.post(options.url).pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeaders({
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': PROTOCOL_VERSION,
        }),
        HttpClientRequest.bodyText(JSON.stringify(payload), 'application/json'),
      )

      const resp = yield* httpClient.execute(request).pipe(
        Eff.Effect.mapError((err) => {
          const inner = (err as { cause?: unknown }).cause
          const detail =
            inner instanceof Error
              ? `${err.message}: ${inner.message}`
              : (err.message ?? String(err))
          return new McpTransportError({ detail })
        }),
      )

      // Notifications get 202 Accepted with no body.
      if (resp.status === 202) return null

      if (resp.status < 200 || resp.status >= 300) {
        return yield* Eff.Effect.fail(
          new McpTransportError({
            detail: `HTTP ${resp.status}`,
            status: resp.status,
          }),
        )
      }

      const text = yield* resp.text.pipe(
        Eff.Effect.mapError(
          (e) => new McpProtocolError({ detail: `body read: ${String(e)}` }),
        ),
      )

      const contentType = resp.headers['content-type'] ?? ''
      let json: unknown
      if (contentType.includes('text/event-stream')) {
        try {
          const parsed = parseSseToJson(text)
          if (parsed === null) return null
          json = parsed
        } catch (e) {
          return yield* Eff.Effect.fail(
            new McpProtocolError({ detail: `SSE parse: ${String(e)}` }),
          )
        }
      } else if (contentType.includes('application/json')) {
        try {
          json = JSON.parse(text)
        } catch (e) {
          return yield* Eff.Effect.fail(
            new McpProtocolError({ detail: `bad JSON: ${String(e)}` }),
          )
        }
      } else {
        return yield* Eff.Effect.fail(
          new McpProtocolError({ detail: `unexpected content-type: ${contentType}` }),
        )
      }

      return yield* decodeWith(JsonRpcResponseSchema, 'envelope')(json)
    }).pipe(Eff.Effect.provide(FetchHttpClient.layer))

  const rpc = (method: string, params?: unknown): Eff.Effect.Effect<unknown, McpError> =>
    Eff.Effect.gen(function* () {
      const id = yield* Eff.Effect.sync(uuid.v4)
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
      return body.result
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
      rpc('tools/list').pipe(
        Eff.Effect.flatMap(decodeWith(ToolsListResponseSchema, 'tools/list')),
        Eff.Effect.map((r) => r.tools as McpToolDescriptor[]),
      ),
    callTool: (name, args) =>
      rpc('tools/call', { name, arguments: args }).pipe(
        Eff.Effect.flatMap(decodeWith(McpToolResultSchema, 'tools/call')),
        Eff.Effect.map((r) => r as unknown as McpToolResult),
      ),
    readResource: (uri) =>
      rpc('resources/read', { uri }).pipe(
        Eff.Effect.flatMap(decodeWith(McpResourceContentsSchema, 'resources/read')),
        Eff.Effect.map((r) => r as unknown as McpResourceContents),
      ),
    ping: () => rpc('ping').pipe(Eff.Effect.asVoid),
  }
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
