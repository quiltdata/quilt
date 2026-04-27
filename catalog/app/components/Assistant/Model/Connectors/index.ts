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
import * as React from 'react'

import { runtime } from 'utils/Effect'
import * as XML from 'utils/XML'

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
/**
 * Optional knobs for one tool-call invocation. Today the only knob is
 * `retryOnTransport`: when `true`, a single transport-level failure is
 * retried before reporting the error and bumping the health counter
 * (D24 — read-only-tool auto-retry).
 */
export interface CallToolOptions {
  readonly retryOnTransport?: boolean
}

export interface ConnectorRuntime {
  readonly id: ConnectorId
  readonly config: ConnectorConfig
  readonly state: Eff.SubscriptionRef.SubscriptionRef<ConnectorState>
  readonly retry: Eff.Effect.Effect<void>
  readonly acknowledge: Eff.Effect.Effect<void>
  readonly callTool: (
    name: string,
    input: Record<string, unknown>,
    opts?: CallToolOptions,
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
 * connector's gated `callTool` (D27 — fast-fail when not Ready). Tools
 * marked `readOnlyHint` are configured to auto-retry once on transport
 * error (D24); tools without the hint, or marked destructive, fail
 * immediately on the first transport failure.
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
  const retryOnTransport = mcp.annotations?.readOnlyHint === true
  return {
    description: mcp.description,
    schema,
    executor: (args) =>
      callTool(mcp.name, args, { retryOnTransport }).pipe(
        Eff.Effect.map(Eff.Option.some),
      ),
  }
}

/**
 * Build the connector's `callTool`: gates on Ready, fires the wire call,
 * and updates the shared health ref on transport-level outcome (D24,
 * D27). Non-transport McpRpcError / McpProtocolError don't disturb
 * health — those are server-application errors, not transport ones.
 *
 * `retryOnTransport` (set by `buildConnectorTool` for read-only tools)
 * triggers a single re-attempt on the first transport failure before
 * reporting the error or counting toward the threshold (D24). The
 * second attempt's outcome is what hits health.
 */
const makeConnectorCallTool =
  (
    connectorId: ConnectorId,
    client: Mcp.McpClient,
    state: Eff.SubscriptionRef.SubscriptionRef<ConnectorState>,
    health: Eff.SubscriptionRef.SubscriptionRef<Health>,
  ) =>
  (
    name: string,
    input: Record<string, unknown>,
    opts: CallToolOptions = {},
  ): Eff.Effect.Effect<Tool.Result> =>
    Eff.Effect.gen(function* () {
      const current = yield* Eff.SubscriptionRef.get(state)
      if (current._tag !== 'Ready') {
        return Tool.fail(
          Content.ToolResultContentBlock.Text({
            text: `Connector "${connectorId}" is not ready (state: ${current._tag}). Tool "${name}" cannot run right now.`,
          }),
        )
      }
      const attempt = client.callTool(name, input).pipe(Eff.Effect.either)
      let result = yield* attempt
      if (
        opts.retryOnTransport &&
        Eff.Either.isLeft(result) &&
        result.left._tag === 'McpTransportError'
      ) {
        result = yield* attempt
      }
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
 *
 * Stale-token drain at entry: any controls offered while the lifecycle
 * was elsewhere (Connecting / Ready / Disconnected, where there's no
 * Retry-from-Failed semantics) get cleared before we start listening,
 * so a button click during a transient state doesn't short-circuit the
 * next user-action gate. Without this, `runtime.retry` from non-Failed
 * states could buffer and immediately fire on the next Failed entry.
 */
const awaitRetryControl = (
  state: Eff.SubscriptionRef.SubscriptionRef<ConnectorState>,
  controls: Eff.Queue.Queue<Control>,
): Eff.Effect.Effect<void> =>
  Eff.Effect.gen(function* () {
    yield* Eff.Queue.takeAll(controls)
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

// ---------------------------------------------------------------------------
// Connectors overview rendering (D29)
// ---------------------------------------------------------------------------

/**
 * Render one `<connector>` element for the LLM-facing overview. Only
 * stable states reach the prompt:
 *
 *  - `Ready`           → `state="ready"`, hint as body
 *  - `Failed{acked}`   → `state="unavailable"`, terse body
 *  - other states      → null (transient + needs-ack states block via
 *                        AwaitingConnector and don't make it here)
 */
const renderConnectorOverview = (
  config: ConnectorConfig,
  state: ConnectorState,
): string | null => {
  const baseAttrs = {
    id: config.id,
    'tool-prefix': `${config.id}__`,
    title: config.title,
  }
  if (state._tag === 'Ready') {
    return XML.tag(
      'connector',
      { ...baseAttrs, state: 'ready' },
      config.hint ?? '',
    ).toString()
  }
  if (state._tag === 'Failed' && state.acked) {
    return XML.tag(
      'connector',
      { ...baseAttrs, state: 'unavailable' },
      'Currently unavailable. Tools from this connector cannot be called.',
    ).toString()
  }
  return null
}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

/**
 * Build a `ConnectorsService` for the given configs. Per-config:
 *
 *  - allocate per-connector state / health / controls refs
 *  - fork the lifecycle fiber under the surrounding `Scope`
 *  - expose the runtime in `byId`
 *
 * Aggregate primitives merge across all per-connector states. Lifecycle
 * fibers are interrupted on scope release (Assistant unmount, D32).
 *
 * Used by both the `layer` factory (production wiring through the
 * Layer system) and React-side allocation (Assistant.tsx invokes this
 * directly via `runtime.runSync` with a manually-managed scope so the
 * resulting service can be passed to chat-UI components alongside being
 * provided to the Conversation actor as a Layer).
 */
export const buildService = (
  configs: readonly ConnectorConfig[],
  /**
   * Per-config wire client override (test seam). Production callers
   * omit it; the wire client is built from `config.transport`.
   */
  clientById: Partial<Record<ConnectorId, Mcp.McpClient>> = {},
): Eff.Effect.Effect<ConnectorsService, never, Eff.Scope.Scope> =>
  Eff.Effect.gen(function* () {
    const runtimes: Record<ConnectorId, ConnectorRuntime> = {}
    for (const c of configs) {
      runtimes[c.id] = yield* buildConnectorRuntime(c, clientById[c.id])
    }
    const all = Object.values(runtimes)

    const allStates = Eff.Effect.all(all.map((r) => Eff.SubscriptionRef.get(r.state)))

    const isTransient = allStates.pipe(
      Eff.Effect.map((states) => states.some(stateIsTransient)),
    )
    const requiresAck = allStates.pipe(
      Eff.Effect.map((states) => states.some(stateRequiresAck)),
    )
    const isBlocked = allStates.pipe(
      Eff.Effect.map((states) => states.some(stateIsBlocked)),
    )

    const awaitUnblocked: Eff.Effect.Effect<void> =
      all.length === 0
        ? Eff.Effect.void
        : Eff.pipe(
            Eff.Stream.mergeAll(
              all.map((r) => r.state.changes),
              { concurrency: 'unbounded' },
            ),
            Eff.Stream.mapEffect(() => isBlocked),
            Eff.Stream.filter((blocked) => !blocked),
            Eff.Stream.take(1),
            Eff.Stream.runDrain,
          )

    const contextContribution: Eff.Effect.Effect<Partial<Context.ContextShape>> =
      Eff.Effect.gen(function* () {
        const tools: Tool.Collection = {}
        const overviews: string[] = []
        for (const r of all) {
          const s = yield* Eff.SubscriptionRef.get(r.state)
          if (s._tag === 'Ready') {
            Object.assign(tools, s.tools)
          }
          const overview = renderConnectorOverview(r.config, s)
          if (overview) overviews.push(overview)
        }
        const messages =
          overviews.length > 0 ? [XML.tag('connectors', {}, ...overviews).toString()] : []
        return { tools, messages }
      })

    return {
      byId: runtimes,
      isTransient,
      requiresAck,
      isBlocked,
      awaitUnblocked,
      contextContribution,
    }
  })

/**
 * `Layer.scoped` wrapper around `buildService`. Suitable for callers
 * that compose Connectors purely through the Layer system (e.g., tests).
 */
export const layer = (
  configs: readonly ConnectorConfig[],
  clientById: Partial<Record<ConnectorId, Mcp.McpClient>> = {},
): Eff.Layer.Layer<Connectors> =>
  Eff.Layer.scoped(Connectors, buildService(configs, clientById))

// Re-exports so catalog wiring can resolve auth / render error info
// without importing the wire-level Mcp module directly.
export { McpAuthError } from './Mcp'
export type { McpError, McpTransportError, McpProtocolError, McpRpcError } from './Mcp'

// ---------------------------------------------------------------------------
// React bridges (D30 — UI reads connector state live)
// ---------------------------------------------------------------------------

/**
 * Subscribe to one connector's state ref. Initial value is read sync;
 * subsequent updates re-render via a forked `Stream.runForEach` over
 * `state.changes`. Cancels its fiber on unmount.
 */
export function useConnectorState(connector: ConnectorRuntime): ConnectorState {
  const [state, setState] = React.useState<ConnectorState>(() =>
    runtime.runSync(Eff.SubscriptionRef.get(connector.state)),
  )
  React.useEffect(() => {
    const fiber = runtime.runFork(
      Eff.Stream.runForEach(connector.state.changes, (s) =>
        Eff.Effect.sync(() => setState(s)),
      ),
    )
    return () => {
      runtime.runFork(Eff.Fiber.interrupt(fiber))
    }
  }, [connector])
  return state
}

/**
 * Subscribe to the aggregate `isBlocked` predicate. Re-evaluates whenever
 * any connector's state changes. Defaults to the synchronous current
 * value at first render.
 */
export function useIsBlocked(service: ConnectorsService): boolean {
  const [blocked, setBlocked] = React.useState<boolean>(() =>
    runtime.runSync(service.isBlocked),
  )
  React.useEffect(() => {
    const all = Object.values(service.byId)
    if (all.length === 0) return
    const fiber = runtime.runFork(
      Eff.Stream.runForEach(
        Eff.Stream.mergeAll(
          all.map((c) => c.state.changes),
          { concurrency: 'unbounded' },
        ),
        () =>
          Eff.Effect.tap(service.isBlocked, (b) => Eff.Effect.sync(() => setBlocked(b))),
      ),
    )
    return () => {
      runtime.runFork(Eff.Fiber.interrupt(fiber))
    }
  }, [service])
  return blocked
}
