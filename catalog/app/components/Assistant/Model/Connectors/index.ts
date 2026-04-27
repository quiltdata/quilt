/**
 * Connectors — registered sources of tools and context for the assistant.
 *
 * A *connector* is the agent-level abstraction (config + state + tools).
 * The wire client (`./Mcp.ts`) is the transport-level concept and stays
 * encapsulated; nothing outside the Connectors module should reference
 * "MCP server" — only "connector".
 *
 * Each connector owns its own `SubscriptionRef<ConnectorState>` (D23). The
 * lifecycle fiber (bootstrap → heartbeat → retry) writes only to its own
 * ref; aggregate predicates merge across all per-connector refs.
 *
 * Today the only `TransportConfig` variant is `Mcp` (bearer-passthrough).
 * Future variants (`McpOauth`, `RestApi`, etc.) extend the taggedEnum.
 *
 * Design: see qhq-5d0 `--design`, sections D20-D33.
 */

import * as Eff from 'effect'

import * as Content from '../Content'
import * as Context from '../Context'
import * as Tool from '../Tool'

import * as Mcp from './Mcp'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type ConnectorId = string

/**
 * Transport-level configuration. The single `Mcp` variant carries the
 * wire-level inputs the `Mcp` client needs (URL + auth resolver). New
 * transports add new variants here.
 */
export type TransportConfig = Eff.Data.TaggedEnum<{
  Mcp: {
    readonly url: string
    readonly auth: () => Eff.Effect.Effect<string, Mcp.McpAuthError>
  }
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const TransportConfig = Eff.Data.taggedEnum<TransportConfig>()

/**
 * Connector configuration — title and hint plus a transport. The hint is
 * static text the LLM sees in the connectors overview (no resource
 * autoload — connectors expose tools to do that themselves).
 */
export interface ConnectorConfig {
  readonly id: ConnectorId
  readonly title: string
  readonly hint?: string
  readonly transport: TransportConfig
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Per-connector state machine (D22):
 *
 *   Connecting ──success──→ Ready
 *   Connecting ──failure──→ Failed{acked:false}
 *   Ready ──health-flip───→ Disconnected{retrying:true}
 *   Disconnected ──retry──→ Connecting
 *   Disconnected ──exhaust→ Failed{acked:false}
 *   Failed ──user retry───→ Connecting
 *   Failed{!acked} ──ack──→ Failed{acked:true}
 *
 * `Failed.acked = false` is the user-action gate: the conversation
 * blocks until Retry or Continue-without (acknowledge).
 */
export type ConnectorState = Eff.Data.TaggedEnum<{
  Connecting: {}
  Ready: {
    readonly tools: Tool.Collection
  }
  Disconnected: {
    readonly retrying: boolean
    readonly error: Mcp.McpError
  }
  Failed: {
    readonly error: Mcp.McpError
    readonly acked: boolean
  }
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ConnectorState = Eff.Data.taggedEnum<ConnectorState>()

/**
 * Auto-progressing — UI shows a spinner, no user action available.
 */
export const stateIsTransient = (s: ConnectorState): boolean =>
  s._tag === 'Connecting' || (s._tag === 'Disconnected' && s.retrying)

/**
 * User must click Retry or Continue-without before the conversation
 * proceeds. Only `Failed{acked:false}` blocks; once acknowledged the
 * connector becomes a stable "unavailable" — visible in the prompt as
 * such, no longer blocks turn-taking.
 */
export const stateRequiresAck = (s: ConnectorState): boolean =>
  s._tag === 'Failed' && !s.acked

export const stateIsBlocked = (s: ConnectorState): boolean =>
  stateIsTransient(s) || stateRequiresAck(s)

// ---------------------------------------------------------------------------
// Runtime + service
// ---------------------------------------------------------------------------

/**
 * Per-connector handle. The state ref is the single source of truth for
 * UI / aggregator queries; `retry` and `acknowledge` are control effects
 * the UI invokes; `callTool` is the executor entrypoint Tool descriptors
 * close over.
 */
export interface ConnectorRuntime {
  readonly id: ConnectorId
  readonly config: ConnectorConfig
  readonly state: Eff.SubscriptionRef.SubscriptionRef<ConnectorState>
  readonly retry: Eff.Effect.Effect<void>
  readonly acknowledge: Eff.Effect.Effect<void>
  readonly callTool: (
    name: string,
    input: Record<string, unknown>,
  ) => Eff.Effect.Effect<Tool.Result>
}

export interface ConnectorsService {
  readonly byId: Record<ConnectorId, ConnectorRuntime>
  readonly isTransient: Eff.Effect.Effect<boolean>
  readonly requiresAck: Eff.Effect.Effect<boolean>
  readonly isBlocked: Eff.Effect.Effect<boolean>
  /**
   * Suspends until `isBlocked` flips to `false`. The Conversation actor
   * forks this at decision points and awaits a `ConnectorReady` action;
   * UI bridges to React via SubscriptionRef hooks.
   */
  readonly awaitUnblocked: Eff.Effect.Effect<void>
  readonly contextContribution: Eff.Effect.Effect<Partial<Context.ContextShape>>
}

export class Connectors extends Eff.Context.Tag('Connectors')<
  Connectors,
  ConnectorsService
>() {}

// ---------------------------------------------------------------------------
// Lifecycle internals (D24)
// ---------------------------------------------------------------------------

/**
 * Heartbeat cadence + timeout + threshold (D24). Both ping failures and
 * tool-call transport failures contribute to `Health.consecutiveFailures`;
 * crossing the threshold flips the state to Disconnected and starts the
 * reconnect budget.
 */
const HEARTBEAT_CADENCE = Eff.Duration.seconds(30)
const HEARTBEAT_TIMEOUT = Eff.Duration.seconds(5)
const HEALTH_THRESHOLD = 2

/**
 * Auto-retry budget for re-bootstrap during Disconnected (D24). Three
 * attempts at 1s/3s/9s; exhaustion transitions to Failed{acked:false}.
 */
const RECONNECT_BACKOFF: ReadonlyArray<Eff.Duration.Duration> = [
  Eff.Duration.seconds(1),
  Eff.Duration.seconds(3),
  Eff.Duration.seconds(9),
]

interface Health {
  readonly consecutiveFailures: number
  readonly lastError: Mcp.McpError | null
}

const INITIAL_HEALTH: Health = { consecutiveFailures: 0, lastError: null }

type Control = 'retry' | 'acknowledge'

/**
 * Permissive Effect schema for connector tool inputs — server's JSON
 * Schema (forwarded raw to Bedrock) is authoritative; we don't decode
 * client-side.
 */
const AnyRecord = Eff.Schema.Record({
  key: Eff.Schema.String,
  value: Eff.Schema.Unknown,
})

/**
 * Build a `Tool.Descriptor` whose executor routes through the
 * connector's gated `callTool`. Identical schema-passthrough as
 * `Mcp.buildTool` but the executor goes through the layer's
 * fast-fail-when-not-Ready path (D27).
 */
const buildConnectorTool = (
  callTool: ConnectorRuntime['callTool'],
  mcp: Mcp.McpToolDescriptor,
): Tool.Descriptor<Record<string, unknown>> => {
  const effectJsonSchema = Tool.makeJSONSchema(AnyRecord)
  const schema = {
    ...effectJsonSchema,
    ...mcp.inputSchema,
    description: mcp.description ?? effectJsonSchema.description,
  }
  return {
    description: mcp.description,
    schema,
    executor: (args) => callTool(mcp.name, args).pipe(Eff.Effect.map(Eff.Option.some)),
  }
}

/**
 * Build the connector's `callTool`: gates on Ready, fires the wire call,
 * and updates the shared health ref on transport-level outcome (D24,
 * D27). Non-transport McpRpcError / McpProtocolError don't disturb
 * health — those are server-application errors, not transport ones.
 */
const makeConnectorCallTool =
  (
    connectorId: ConnectorId,
    client: Mcp.McpClient,
    state: Eff.SubscriptionRef.SubscriptionRef<ConnectorState>,
    health: Eff.SubscriptionRef.SubscriptionRef<Health>,
  ) =>
  (name: string, input: Record<string, unknown>): Eff.Effect.Effect<Tool.Result> =>
    Eff.Effect.gen(function* () {
      const current = yield* Eff.SubscriptionRef.get(state)
      if (current._tag !== 'Ready') {
        return Tool.fail(
          Content.ToolResultContentBlock.Text({
            text: `Connector "${connectorId}" is not ready (state: ${current._tag}). Tool "${name}" cannot run right now.`,
          }),
        )
      }
      const result = yield* client.callTool(name, input).pipe(Eff.Effect.either)
      if (Eff.Either.isLeft(result)) {
        const err = result.left
        if (err._tag === 'McpTransportError') {
          yield* Eff.SubscriptionRef.update(health, (h) => ({
            consecutiveFailures: h.consecutiveFailures + 1,
            lastError: err,
          }))
        }
        return Tool.fail(
          Content.ToolResultContentBlock.Text({ text: `${name}: ${err.message}` }),
        )
      }
      yield* Eff.SubscriptionRef.set(health, INITIAL_HEALTH)
      const blocks = result.right.content.map(Mcp.mapContent)
      return result.right.isError ? Tool.fail(...blocks) : Tool.succeed(...blocks)
    })

/**
 * Bootstrap: `initialize` + `tools/list`. No resource autoload — D21.
 * Returns the connector's `Tool.Collection` (keyed `<id>__<name>`).
 */
const bootstrap = (
  config: ConnectorConfig,
  client: Mcp.McpClient,
  callTool: ConnectorRuntime['callTool'],
): Eff.Effect.Effect<Tool.Collection, Mcp.McpError> =>
  Eff.Effect.gen(function* () {
    yield* client.initialize()
    const mcpTools = yield* client.listTools()
    const tools: Tool.Collection = {}
    for (const t of mcpTools) {
      tools[`${config.id}__${t.name}`] = buildConnectorTool(callTool, t)
    }
    return tools
  })

/**
 * Heartbeat ping loop (D24). Runs forever; each tick pings with timeout
 * and updates `health` on outcome. Tool-call transport failures bump
 * the same counter externally — `awaitThresholdCrossed` watches the
 * shared ref and fires whenever the threshold crosses, regardless of
 * source.
 */
const runHeartbeat = (
  client: Mcp.McpClient,
  health: Eff.SubscriptionRef.SubscriptionRef<Health>,
): Eff.Effect.Effect<never> =>
  Eff.Effect.gen(function* () {
    while (true) {
      yield* Eff.Effect.sleep(HEARTBEAT_CADENCE)
      const result = yield* client.ping().pipe(
        Eff.Effect.timeoutFail({
          duration: HEARTBEAT_TIMEOUT,
          onTimeout: (): Mcp.McpError =>
            new Mcp.McpTransportError({ detail: 'ping timeout' }),
        }),
        Eff.Effect.either,
      )
      if (Eff.Either.isLeft(result)) {
        yield* Eff.SubscriptionRef.update(health, (h) => ({
          consecutiveFailures: h.consecutiveFailures + 1,
          lastError: result.left,
        }))
      } else {
        yield* Eff.SubscriptionRef.set(health, INITIAL_HEALTH)
      }
    }
  })

/**
 * Suspends until `health.consecutiveFailures >= HEALTH_THRESHOLD`. The
 * subscription stream re-emits the current value on subscribe, so a
 * stale degraded state is observed immediately on entry.
 */
const awaitThresholdCrossed = (
  health: Eff.SubscriptionRef.SubscriptionRef<Health>,
): Eff.Effect.Effect<void> =>
  Eff.pipe(
    health.changes,
    Eff.Stream.filter((h) => h.consecutiveFailures >= HEALTH_THRESHOLD),
    Eff.Stream.take(1),
    Eff.Stream.runDrain,
  )

/**
 * Reconnect budget (D24). Three attempts at 1s/3s/9s; first success
 * returns the fresh `Tool.Collection`, exhaustion fails with the last
 * `McpError`. The connector stays in `Disconnected{retrying:true}`
 * throughout — UI shows "reconnecting…".
 */
const runReconnectBudget = (
  config: ConnectorConfig,
  client: Mcp.McpClient,
  callTool: ConnectorRuntime['callTool'],
): Eff.Effect.Effect<Tool.Collection, Mcp.McpError> =>
  Eff.Effect.gen(function* () {
    let lastError: Mcp.McpError | null = null
    for (const delay of RECONNECT_BACKOFF) {
      yield* Eff.Effect.sleep(delay)
      const attempt = yield* bootstrap(config, client, callTool).pipe(Eff.Effect.either)
      if (Eff.Either.isRight(attempt)) return attempt.right
      lastError = attempt.left
    }
    return yield* Eff.Effect.fail(
      lastError ?? new Mcp.McpTransportError({ detail: 'reconnect exhausted' }),
    )
  })

/**
 * Drain the controls queue while in Failed. `'retry'` returns
 * (caller loops back to Connecting); `'acknowledge'` flips
 * `Failed.acked = true` in place and keeps listening (user may still
 * click Retry afterwards).
 */
const awaitRetryControl = (
  state: Eff.SubscriptionRef.SubscriptionRef<ConnectorState>,
  controls: Eff.Queue.Queue<Control>,
): Eff.Effect.Effect<void> =>
  Eff.Effect.gen(function* () {
    while (true) {
      const cmd = yield* Eff.Queue.take(controls)
      if (cmd === 'retry') return
      yield* Eff.SubscriptionRef.update(state, (s) =>
        s._tag === 'Failed' && !s.acked
          ? ConnectorState.Failed({ error: s.error, acked: true })
          : s,
      )
    }
  })

/**
 * Long-running connector lifecycle. Sole writer to `state` (D23). Loops:
 * Connecting → (Ready loop with heartbeat + reconnect budget) → Failed
 * → wait for retry → repeat. Interrupted on Layer release.
 */
export const manageConnector = (
  config: ConnectorConfig,
  client: Mcp.McpClient,
  state: Eff.SubscriptionRef.SubscriptionRef<ConnectorState>,
  health: Eff.SubscriptionRef.SubscriptionRef<Health>,
  controls: Eff.Queue.Queue<Control>,
  callTool: ConnectorRuntime['callTool'],
): Eff.Effect.Effect<never> =>
  Eff.Effect.gen(function* () {
    while (true) {
      yield* Eff.SubscriptionRef.set(state, ConnectorState.Connecting())
      yield* Eff.SubscriptionRef.set(health, INITIAL_HEALTH)
      const initial = yield* bootstrap(config, client, callTool).pipe(Eff.Effect.either)
      if (Eff.Either.isLeft(initial)) {
        yield* Eff.SubscriptionRef.set(
          state,
          ConnectorState.Failed({ error: initial.left, acked: false }),
        )
        yield* awaitRetryControl(state, controls)
        continue
      }

      let tools = initial.right
      let inReady = true
      while (inReady) {
        yield* Eff.SubscriptionRef.set(state, ConnectorState.Ready({ tools }))
        yield* Eff.SubscriptionRef.set(health, INITIAL_HEALTH)

        // Race: heartbeat loop runs forever; threshold-crossing watcher
        // fires (and wins) when consecutiveFailures ≥ THRESHOLD from any
        // source (heartbeat itself or external tool-call bumps).
        yield* Eff.Effect.race(
          runHeartbeat(client, health),
          awaitThresholdCrossed(health),
        )

        const h = yield* Eff.SubscriptionRef.get(health)
        const transportErr =
          h.lastError ??
          new Mcp.McpTransportError({ detail: 'transport health degraded' })
        yield* Eff.SubscriptionRef.set(
          state,
          ConnectorState.Disconnected({ retrying: true, error: transportErr }),
        )

        const reconnect = yield* runReconnectBudget(config, client, callTool).pipe(
          Eff.Effect.either,
        )
        if (Eff.Either.isRight(reconnect)) {
          tools = reconnect.right
          // loop back to Ready with refreshed tool collection
        } else {
          yield* Eff.SubscriptionRef.set(
            state,
            ConnectorState.Failed({ error: reconnect.left, acked: false }),
          )
          inReady = false
        }
      }

      yield* awaitRetryControl(state, controls)
    }
  })

const makeTransportClient = (transport: TransportConfig): Mcp.McpClient =>
  TransportConfig.$match(transport, {
    Mcp: ({ url, auth }) => Mcp.make({ url, getToken: auth }),
  })

/**
 * Build a `ConnectorRuntime` for one config. Allocates per-connector
 * refs + queue, wires the gated `callTool`, and forks the lifecycle
 * fiber under the surrounding scope. The optional `client` parameter
 * is for tests; production callers omit it and the wire client is
 * built from `config.transport`.
 */
export const buildConnectorRuntime = (
  config: ConnectorConfig,
  client: Mcp.McpClient = makeTransportClient(config.transport),
): Eff.Effect.Effect<ConnectorRuntime, never, Eff.Scope.Scope> =>
  Eff.Effect.gen(function* () {
    const state = yield* Eff.SubscriptionRef.make<ConnectorState>(
      ConnectorState.Connecting(),
    )
    const health = yield* Eff.SubscriptionRef.make<Health>(INITIAL_HEALTH)
    const controls = yield* Eff.Queue.unbounded<Control>()
    const callTool = makeConnectorCallTool(config.id, client, state, health)

    yield* Eff.Effect.forkScoped(
      manageConnector(config, client, state, health, controls, callTool),
    )

    return {
      id: config.id,
      config,
      state,
      retry: Eff.Queue.offer(controls, 'retry').pipe(Eff.Effect.asVoid),
      acknowledge: Eff.Queue.offer(controls, 'acknowledge').pipe(Eff.Effect.asVoid),
      callTool,
    }
  })

// ---------------------------------------------------------------------------
// Layer (skeleton)
// ---------------------------------------------------------------------------

/**
 * Empty placeholder. Step 4 wires the service primitives and aggregates
 * across all per-connector runtimes. Until then this layer satisfies
 * the Tag with a no-op service so types stay coherent during the
 * incremental refactor.
 */
export const layer = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _configs: readonly ConnectorConfig[],
): Eff.Layer.Layer<Connectors> =>
  Eff.Layer.succeed(Connectors, {
    byId: {},
    isTransient: Eff.Effect.succeed(false),
    requiresAck: Eff.Effect.succeed(false),
    isBlocked: Eff.Effect.succeed(false),
    awaitUnblocked: Eff.Effect.void,
    contextContribution: Eff.Effect.succeed({}),
  })
