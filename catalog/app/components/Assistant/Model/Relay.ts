import type BedrockRuntime from 'aws-sdk/clients/bedrockruntime'
import * as Eff from 'effect'

import * as Log from 'utils/Logging'

import * as Content from './Content'
import * as LLM from './LLM'

const MODULE = 'Relay'

// What the SDK client did and a bare fetch does not: a request deadline, and
// a retry with backoff on a throttle or a server error.
const REQUEST_TIMEOUT_MS = 120_000
// A server's Retry-After is honoured up to this, so one hint cannot stall the chat.
const RETRY_AFTER_CAP_S = 15
// The registry's fixed hint when every relay slot is taken: its CORS policy
// does not expose Retry-After, so the browser cannot read the header.
const BUSY_RETRY_AFTER_S = 10
const BUSY_MESSAGE = 'Qurator is busy with other requests. Try again in a minute.'

class Failure {
  readonly _tag = 'Failure'
  constructor(
    readonly message: string,
    readonly retry: 'busy' | 'transient' | 'never',
    readonly retryAfter: Eff.Duration.Duration = Eff.Duration.zero,
  ) {}
}

const honourRetryAfter = Eff.Schedule.identity<Failure>().pipe(
  Eff.Schedule.addDelay((e) => e.retryAfter),
)
const TRANSIENT_SCHEDULE = Eff.Schedule.exponential('300 millis').pipe(
  Eff.Schedule.intersect(Eff.Schedule.recurs(3)),
  Eff.Schedule.intersect(honourRetryAfter),
)
// Six waits of the registry's hint: about a minute queued behind other asks.
const BUSY_SCHEDULE = Eff.Schedule.recurs(6).pipe(
  Eff.Schedule.intersect(honourRetryAfter),
)

/**
 * The same `LLM` service `Bedrock.ts` provided, but the request goes to the
 * registry's inference relay instead of straight to Bedrock from the browser.
 *
 * The relay signs with the caller's own credentials on the default path and
 * bears a gateway credential when a deployment configures one, so the browser
 * never holds either. What the relay receives is the Converse request body
 * the SDK would have sent: the wire shape is identical, only the transport and
 * the signer differ.
 */
export interface RelayOptions {
  /** Base URL of the relay, e.g. `${registryUrl}/api/inference`. */
  url: string
  modelId: Eff.Effect.Effect<string>
  /**
   * The catalog session token, re-read on every call so rotation needs no
   * plumbing. `null` when no session is available.
   */
  getToken: () => Eff.Effect.Effect<string | null>
  record?: (r: string) => Eff.Effect.Effect<void>
}

type Bytes = Buffer | Uint8Array | Blob | ArrayBuffer | string

/**
 * The SDK base64-encodes `source.bytes` on the wire (verified against the
 * pinned aws-sdk). Callers hand over raw bytes in several runtime shapes -- a
 * Buffer from the MCP connector, an ArrayBuffer from a preview fetch, a Blob
 * from S3 -- and one of them is async to read, so the whole encode is.
 */
const toBase64 = (source: Bytes): Eff.Effect.Effect<string, LLM.LLMError> =>
  Eff.Effect.tryPromise({
    try: async () => {
      if (typeof source === 'string') return source
      const buf =
        source instanceof Blob
          ? new Uint8Array(await source.arrayBuffer())
          : source instanceof ArrayBuffer
            ? new Uint8Array(source)
            : source
      return Buffer.from(buf).toString('base64')
    },
    catch: (e) => new LLM.LLMError({ message: `Could not encode content: ${e}` }),
  })

const encodeToolResultBlock = (b: Content.ToolResultContentBlock) =>
  Content.ToolResultContentBlock.$match(b, {
    Json: ({ _tag, ...rest }) => Eff.Effect.succeed(rest),
    Text: ({ _tag, ...rest }) => Eff.Effect.succeed(rest),
    Image: ({ format, source }) =>
      toBase64(source as Bytes).pipe(
        Eff.Effect.map((bytes) => ({ image: { format, source: { bytes } } })),
      ),
    Document: ({ format, source, name }) =>
      toBase64(source as Bytes).pipe(
        Eff.Effect.map((bytes) => ({ document: { format, source: { bytes }, name } })),
      ),
  })

const encodeBlock = (b: Content.PromptMessageContentBlock) =>
  Content.PromptMessageContentBlock.$match(b, {
    GuardContent: ({ text }) => Eff.Effect.succeed({ guardContent: { text: { text } } }),
    ToolResult: ({ toolUseId, status, content }) =>
      Eff.Effect.forEach(content, encodeToolResultBlock).pipe(
        Eff.Effect.map((encoded) => ({
          toolResult: { toolUseId, status, content: encoded },
        })),
      ),
    ToolUse: ({ _tag, ...toolUse }) => Eff.Effect.succeed({ toolUse }),
    Text: ({ _tag, ...rest }) => Eff.Effect.succeed(rest),
    Image: ({ format, source }) =>
      toBase64(source as Bytes).pipe(
        Eff.Effect.map((bytes) => ({ image: { format, source: { bytes } } })),
      ),
    Document: ({ format, source, name }) =>
      toBase64(source as Bytes).pipe(
        Eff.Effect.map((bytes) => ({ document: { format, source: { bytes }, name } })),
      ),
  })

const encodeMessages = (messages: Eff.Array.NonEmptyArray<LLM.PromptMessage>) =>
  Eff.pipe(
    messages,
    // alternate roles: adjacent same-role messages fold into one, as the SDK path does
    Eff.Array.groupWith((m1, m2) => m1.role === m2.role),
    Eff.Effect.forEach((group) =>
      Eff.Effect.forEach(group, (m) => encodeBlock(m.content)).pipe(
        Eff.Effect.map((content) => ({ role: group[0].role, content })),
      ),
    ),
  )

const encodeToolConfig = (toolConfig: LLM.ToolConfig) => ({
  tools: Object.entries(toolConfig.tools).map(([name, { description, schema }]) => ({
    toolSpec: { name, description, inputSchema: { json: schema } },
  })),
  toolChoice:
    toolConfig.choice &&
    LLM.ToolChoice.$match(toolConfig.choice, {
      Auto: () => ({ auto: {} }),
      Any: () => ({ any: {} }),
      Specific: ({ name }) => ({ tool: { name } }),
    }),
})

// Response blocks come back exactly as the SDK would have parsed them, except
// that bytes arrive base64 rather than as a Buffer. Nothing downstream renders
// response-side bytes; they are only forwarded or logged, so a string is fine.
const mapContent = (contentBlocks: BedrockRuntime.ContentBlocks | undefined) =>
  Eff.pipe(
    contentBlocks,
    Eff.Option.fromNullable,
    Eff.Option.map(
      Eff.Array.flatMapNullable((c) => {
        if (c.document) {
          return Content.ResponseMessageContentBlock.Document({
            format: c.document.format as $TSFixMe,
            source: c.document.source.bytes as $TSFixMe,
            name: c.document.name,
          })
        }
        if (c.image) {
          return Content.ResponseMessageContentBlock.Image({
            format: c.image.format as $TSFixMe,
            source: c.image.source.bytes as $TSFixMe,
          })
        }
        if (c.text) return Content.ResponseMessageContentBlock.Text({ text: c.text })
        if (c.toolUse)
          return Content.ResponseMessageContentBlock.ToolUse(c.toolUse as $TSFixMe)
        return null
      }),
    ),
  )

/**
 * Decide whether a non-2xx relay answer is retried, and what the chat shows.
 * A provider error keeps the shape `Bedrock.ts` produces: the relay passes its
 * body through untouched, and both Bedrock and a gateway put the text under
 * `message`, with differing capitalisation. The relay's own errors carry an
 * `error_code`.
 */
const classifyFailure = (r: Response, body: string): Failure => {
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(body) ?? {}
  } catch {
    // not JSON
  }
  const msg = parsed.message ?? parsed.Message
  const seconds = Number(r.headers.get('retry-after'))
  const hint = seconds > 0 ? Math.min(seconds, RETRY_AFTER_CAP_S) : null
  if (r.status === 429 && parsed.error_code === 'Busy') {
    return new Failure(
      BUSY_MESSAGE,
      'busy',
      Eff.Duration.seconds(hint ?? BUSY_RETRY_AFTER_S),
    )
  }
  // The gateway's endpoint or credential is unusable, which a retry seldom fixes.
  if (parsed.error_code === 'NotAvailable' && typeof msg === 'string') {
    return new Failure(msg, 'never')
  }
  return new Failure(
    typeof msg === 'string'
      ? `Inference error (HTTP ${r.status}): ${msg}`
      : `Inference error (HTTP ${r.status})`,
    r.status === 429 || r.status >= 500 ? 'transient' : 'never',
    Eff.Duration.seconds(hint ?? 0),
  )
}

export function LLMRelay(options: RelayOptions) {
  const converse = (prompt: LLM.Prompt, opts?: LLM.Options) =>
    Log.scoped({
      name: `${MODULE}.converse`,
      enter: [Log.br, 'prompt:', prompt, Log.br, 'opts:', opts],
    })(
      Eff.Effect.gen(function* () {
        const token = yield* options.getToken()
        if (!token) {
          return yield* Eff.Effect.fail(
            new LLM.LLMError({ message: 'No authenticated session' }),
          )
        }
        const requestTimestamp = new Date(yield* Eff.Clock.currentTimeMillis)
        const modelId = yield* options.modelId
        const messages = yield* encodeMessages(prompt.messages)
        const requestBody = {
          system: [{ text: prompt.system }],
          messages,
          toolConfig: prompt.toolConfig && encodeToolConfig(prompt.toolConfig),
          ...opts,
        }

        // Re-read per attempt: a Busy wait can outlast the session token.
        const attempt = Eff.Effect.flatMap(options.getToken(), (fresh) =>
          Eff.Effect.tryPromise({
            try: async () => {
              const r = await fetch(
                `${options.url}/model/${encodeURIComponent(modelId)}/converse`,
                {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${fresh ?? token}`,
                  },
                  body: JSON.stringify(requestBody),
                  signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                },
              )
              const text = await r.text()
              if (!r.ok) throw classifyFailure(r, text)
              return JSON.parse(text) as BedrockRuntime.ConverseResponse
            },
            catch: (e) =>
              e instanceof Failure
                ? e
                : new Failure(
                    e instanceof Error ? e.message : `Unexpected error: ${e}`,
                    'never',
                  ),
          }),
        )
        const backendResponse = yield* attempt.pipe(
          Eff.Effect.retry({
            schedule: TRANSIENT_SCHEDULE,
            while: (e) => e.retry === 'transient',
          }),
          Eff.Effect.retry({
            schedule: BUSY_SCHEDULE,
            while: (e) => e.retry === 'busy',
          }),
          Eff.Effect.mapError((e) => new LLM.LLMError({ message: e.message })),
        )

        const responseTimestamp = new Date(yield* Eff.Clock.currentTimeMillis)
        if (options.record) {
          yield* options.record(
            JSON.stringify(
              {
                requestTimestamp,
                responseTimestamp,
                modelId,
                request: requestBody,
                response: backendResponse,
              },
              null,
              2,
            ),
          )
        }
        return {
          backendResponse,
          content: mapContent(backendResponse.output?.message?.content),
        }
      }),
    )

  return Eff.Layer.succeed(LLM.LLM, { converse })
}
