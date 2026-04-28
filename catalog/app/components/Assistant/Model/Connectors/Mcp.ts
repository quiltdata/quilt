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
import * as Tool from '../Tool'

// Type-only imports of the Backend contract — runtime dependency stays
// one-way (index.ts depends on Mcp.ts) so this is purely compile-time.
import type {
  Backend,
  BackendError,
  BackendResourceDescriptor,
  BackendToolDescriptor,
} from '.'

const PROTOCOL_VERSION = '2025-06-18'
const CLIENT_INFO = { name: 'quilt-catalog', version: '1' } as const

// ---------------------------------------------------------------------------
// Types (wire + tool)
// ---------------------------------------------------------------------------

/**
 * Subset of MCP tool annotations the catalog cares about. The wire spec
 * permits more (e.g. `idempotentHint`, `openWorldHint`); the connector
 * layer only consumes `readOnlyHint` today (D24 — read-only-tool
 * auto-retry once on transport error before counting toward the
 * health-threshold).
 */
export interface McpToolAnnotations {
  readOnlyHint?: boolean
  destructiveHint?: boolean
}

export interface McpToolDescriptor {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
  annotations?: McpToolAnnotations
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

/**
 * Resource directory entry from `resources/list`. Servers may publish
 * any subset of these fields beyond `uri`; the catalog renders whatever
 * the server provides into the connector overview so the model knows
 * what URIs to feed `get_resource`.
 */
export interface McpResourceDescriptor {
  uri: string
  name?: string
  description?: string
  mimeType?: string
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

const McpToolAnnotationsSchema = Eff.Schema.Struct({
  readOnlyHint: Eff.Schema.optional(Eff.Schema.Boolean),
  destructiveHint: Eff.Schema.optional(Eff.Schema.Boolean),
})

const McpToolDescriptorSchema = Eff.Schema.Struct({
  name: Eff.Schema.String,
  description: Eff.Schema.optional(Eff.Schema.String),
  inputSchema: Eff.Schema.Record({
    key: Eff.Schema.String,
    value: Eff.Schema.Unknown,
  }),
  annotations: Eff.Schema.optional(McpToolAnnotationsSchema),
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

const McpResourceDescriptorSchema = Eff.Schema.Struct({
  uri: Eff.Schema.String,
  name: Eff.Schema.optional(Eff.Schema.String),
  description: Eff.Schema.optional(Eff.Schema.String),
  mimeType: Eff.Schema.optional(Eff.Schema.String),
})

const ResourcesListResponseSchema = Eff.Schema.Struct({
  resources: Eff.Schema.Array(McpResourceDescriptorSchema),
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
  listResources: () => Eff.Effect.Effect<McpResourceDescriptor[], McpError>
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

      // `withTracerPropagation(false)` strips the W3C `traceparent` + Zipkin
      // `b3` headers Effect's HttpClient injects from the active span. The
      // platform MCP server uses a strict CORS allow-list and rejects unknown
      // headers (preflight returns 400 "Disallowed CORS headers"); we don't
      // have a tracing collector on the receiving end either, so the headers
      // are pure cost.
      const resp = yield* httpClient.execute(request).pipe(
        HttpClient.withTracerPropagation(false),
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
    listResources: () =>
      rpc('resources/list').pipe(
        Eff.Effect.flatMap(decodeWith(ResourcesListResponseSchema, 'resources/list')),
        Eff.Effect.map((r) => r.resources as McpResourceDescriptor[]),
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
      // MCP delivers `data` as a base64 string; ImageBlock.source is supposed
      // to hold the raw bytes (Bedrock's AWS SDK base64-encodes them itself).
      // Pass-through would double-encode and Bedrock rejects with
      // ValidationException: Could not process image.
      return Content.ToolResultContentBlock.Image({
        format,
        source: Buffer.from(img.data, 'base64'),
      })
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

// ---------------------------------------------------------------------------
// Backend adapter — `bearerPassthru` (1st-party, catalog auth passthrough)
// ---------------------------------------------------------------------------

const adaptDescriptor = (m: McpToolDescriptor): BackendToolDescriptor => ({
  name: m.name,
  description: m.description,
  inputSchema: m.inputSchema,
  readOnly: m.annotations?.readOnlyHint,
})

const adaptResourceDescriptor = (
  m: McpResourceDescriptor,
): BackendResourceDescriptor => ({
  uri: m.uri,
  name: m.name,
  description: m.description,
  mimeType: m.mimeType,
})

const adaptResult = (r: McpToolResult): Tool.Result => {
  const blocks = r.content.map(mapContent)
  return r.isError ? Tool.fail(...blocks) : Tool.succeed(...blocks)
}

/**
 * Map a wire-level `McpError` to the abstract `BackendError`. Wire tag
 * is preserved on `cause` for DevTools / telemetry; UI copy comes from
 * the abstract `_tag` and `message` so MCP vocabulary doesn't leak past
 * the connector boundary.
 *
 *   McpTransportError  → Transport (transient)
 *   McpAuthError       → Auth
 *   McpProtocolError   → Protocol
 *   McpRpcError        → Application
 */
const ERROR_TAG_MAP: Record<McpError['_tag'], BackendError['_tag']> = {
  McpTransportError: 'Transport',
  McpAuthError: 'Auth',
  McpProtocolError: 'Protocol',
  McpRpcError: 'Application',
}

const adaptError = (e: McpError): BackendError => ({
  _tag: ERROR_TAG_MAP[e._tag],
  message: e.message,
  transient: e._tag === 'McpTransportError',
  retryable: e._tag === 'McpTransportError' && e.status === undefined,
  cause: e._tag,
})

export interface BearerPassthruOptions {
  readonly url: string
  /**
   * Resolve the bearer token. Returns `null` when no authenticated
   * session is available — the backend maps this to an internal
   * `McpAuthError` without firing fetch. Re-read on every call so
   * token rotation is handled without explicit plumbing.
   */
  readonly getToken: () => Eff.Effect.Effect<string | null>
}

/**
 * 1st-party MCP backend with bearer-passthrough auth. The caller
 * resolves the bearer token (typically a catalog session JWT) on every
 * call; the backend forwards it as `Authorization: Bearer <token>` and
 * doesn't manage refresh, expiry, or session state.
 *
 * Distinct from a hypothetical `oauth(...)` factory (which would run the
 * OAuth flow itself) or a stateful backend (which would maintain a
 * session). Pairs with FastMCP's `stateless_http=True` transport mode.
 *
 * Design: see qhq-5d0 `--design`, D8 / D9 / D33.
 */
export const bearerPassthru = (opts: BearerPassthruOptions): Backend => {
  const wire = make({
    url: opts.url,
    getToken: () =>
      opts
        .getToken()
        .pipe(
          Eff.Effect.flatMap((tok) =>
            tok ? Eff.Effect.succeed(tok) : Eff.Effect.fail(new McpAuthError()),
          ),
        ),
  })
  const lift = <A>(eff: Eff.Effect.Effect<A, McpError>) =>
    eff.pipe(Eff.Effect.mapError(adaptError))
  return {
    initialize: () => lift(wire.initialize()),
    listTools: () =>
      lift(wire.listTools()).pipe(Eff.Effect.map((ds) => ds.map(adaptDescriptor))),
    listResources: () =>
      lift(wire.listResources()).pipe(
        Eff.Effect.map((ds) => ds.map(adaptResourceDescriptor)),
      ),
    readResource: (uri) =>
      lift(wire.readResource(uri)).pipe(
        // MCP resources/read returns `contents: [{ uri, text?, mimeType? }]`.
        // Concatenate text parts; binary parts (no `text`) are skipped — autoload
        // is text-content-only by design.
        Eff.Effect.map((r) =>
          r.contents
            .map((c) => c.text)
            .filter((t): t is string => typeof t === 'string')
            .join('\n'),
        ),
      ),
    callTool: (name, input) =>
      lift(wire.callTool(name, input)).pipe(Eff.Effect.map(adaptResult)),
    ping: () => lift(wire.ping()),
  }
}
