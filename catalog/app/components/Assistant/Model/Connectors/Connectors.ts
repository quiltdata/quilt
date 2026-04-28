/**
 * Connectors — registered sources of tools and context for the assistant.
 *
 * A *connector* is the agent-level abstraction (config + state + tools).
 * Lifecycle (Connecting → Ready → Disconnected → Failed, heartbeat,
 * reconnect budget) is generic in `Backend`, the connector's behavioral
 * contract. Concrete backends (today: `Mcp.bearerPassthru` for 1st-party
 * MCP with catalog session JWT; later: maybe `Mcp.oauth` or others)
 * adapt their wire protocol into `Backend`.
 *
 * Each connector owns its own `SubscriptionRef<ConnectorState>` (D23). The
 * lifecycle fiber (bootstrap → heartbeat → retry) writes only to its own
 * ref; aggregate predicates merge across all per-connector refs.
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

// ---------------------------------------------------------------------------
// Backend — the connector's behavioral contract
// ---------------------------------------------------------------------------

/**
 * Abstract error category surfaced to UI / lifecycle — independent of
 * the concrete wire protocol. Backends must map their wire-level errors
 * onto these tags so the connector layer (and DevTools) doesn't speak
 * "MCP" or any other transport vocabulary.
 *
 *   Transport   — network-level failure (timeouts, refused connections,
 *                 5xx, transport health degraded). Counts toward health.
 *   Auth        — credentials missing / rejected. Application-level.
 *   Protocol    — wire envelope / schema decode failure.
 *   Application — server-side business error (e.g., JSON-RPC error).
 */
export type BackendErrorTag = 'Transport' | 'Auth' | 'Protocol' | 'Application'

/**
 * A tagged error returned by a backend operation. Concrete error
 * classes live in the backend implementation; lifecycle only inspects
 * `_tag` (for routing / health classification) and `transient` (whether
 * to count toward the health threshold). `cause` carries the wire-level
 * tag for telemetry / hover detail; UI primary copy uses `_tag` +
 * `message`.
 */
export interface BackendError {
  readonly _tag: BackendErrorTag
  readonly message: string
  /**
   * Whether this error counts toward the health threshold. True for
   * `Transport` errors (the only category that signals network-level
   * failure); false otherwise. Lifecycle uses this to decide whether to
   * bump the health counter on tool-call failure (D24).
   */
  readonly transient?: boolean
  /**
   * Optional wire-level error tag (e.g., MCP's `McpTransportError`).
   * Surfaced in DevTools detail / hover; not used for control flow.
   */
  readonly cause?: string
}

export interface BackendToolDescriptor {
  readonly name: string
  readonly description?: string
  readonly inputSchema: Record<string, unknown>
  /**
   * Generic version of MCP's `readOnlyHint` annotation (D24): when true,
   * a single transport-level failure is retried once before reporting
   * the error or counting toward the threshold. Destructive tools (or
   * tools without the hint) fail immediately.
   */
  readonly readOnly?: boolean
}

/**
 * The connector's behavioral surface. Implementations adapt a wire
 * protocol (today: 1st-party MCP via `Mcp.bearerPassthru`; later: maybe
 * OAuth-flavored MCP, in-process tools, etc.) into this interface.
 * Lifecycle (Connecting → Ready → Disconnected → Failed, heartbeat,
 * reconnect budget) is fully generic in `Backend`.
 */
export interface Backend {
  readonly initialize: () => Eff.Effect.Effect<void, BackendError>
  readonly listTools: () => Eff.Effect.Effect<
    readonly BackendToolDescriptor[],
    BackendError
  >
  readonly callTool: (
    name: string,
    input: Record<string, unknown>,
  ) => Eff.Effect.Effect<Tool.Result, BackendError>
  readonly ping: () => Eff.Effect.Effect<void, BackendError>
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type ConnectorId = string

/**
 * Connector configuration — title, hint, and the backend instance the
 * lifecycle drives. The hint is static text the LLM sees in the
 * connectors overview (no resource autoload — connectors expose tools
 * to do that themselves).
 */
export interface ConnectorConfig {
  readonly id: ConnectorId
  readonly title: string
  readonly hint?: string
  readonly backend: Backend
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
    readonly error: BackendError
  }
  Failed: {
    readonly error: BackendError
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
 * reconnect probe loop.
 */
const HEARTBEAT_CADENCE = Eff.Duration.seconds(30)
const HEARTBEAT_TIMEOUT = Eff.Duration.seconds(5)
const HEALTH_THRESHOLD = 2

/**
 * Disconnected-mode probe parameters (D24, qhq-5d0.6). The lifecycle
 * pings at escalating cadence (`PROBE_CADENCE_INITIAL`, doubled each
 * failure, capped at `PROBE_CADENCE_MAX`); each successful ping triggers
 * a bootstrap attempt (cap: `RECONNECT_MAX_ATTEMPTS`). If ping never
 * succeeds within `DISCONNECTED_MAX_DURATION`, fail with a
 * synthetic `DisconnectedTimeout` `Transport` error.
 */
const PROBE_CADENCE_INITIAL = Eff.Duration.seconds(5)
const PROBE_CADENCE_MAX = Eff.Duration.seconds(30)
const RECONNECT_MAX_ATTEMPTS = 3
const DISCONNECTED_MAX_DURATION = Eff.Duration.seconds(60)

interface Health {
  readonly consecutiveFailures: number
  readonly lastError: BackendError | null
}

const INITIAL_HEALTH: Health = { consecutiveFailures: 0, lastError: null }

/**
 * Reset health to INITIAL_HEALTH but skip the SubscriptionRef emission
 * if it's already initial — avoids waking the threshold-crossing watcher
 * (and any future subscribers) on every successful ping or tool call.
 */
const resetHealth = (
  health: Eff.SubscriptionRef.SubscriptionRef<Health>,
): Eff.Effect.Effect<void> =>
  Eff.SubscriptionRef.update(health, (h) =>
    h.consecutiveFailures === 0 && h.lastError === null ? h : INITIAL_HEALTH,
  )

/**
 * Construct a `Transport` `BackendError` for lifecycle-internal failures
 * (ping timeout, threshold-degraded, reconnect-exhausted) — situations
 * where the lifecycle synthesizes an error rather than receiving one
 * from the backend. `cause` carries the lifecycle-internal kind for
 * telemetry detail.
 */
const transientError = (cause: string, message: string): BackendError => ({
  _tag: 'Transport',
  message,
  transient: true,
  cause,
})

type Control = 'retry' | 'acknowledge'

/**
 * Build a `Tool.Descriptor` whose executor routes through the
 * connector's gated `callTool` (D27 — fast-fail when not Ready). Tools
 * marked `readOnly` auto-retry once on transport error (D24); tools
 * without the hint, or marked destructive, fail immediately on the
 * first transport failure.
 */
const buildConnectorTool = (
  callTool: ConnectorRuntime['callTool'],
  descriptor: BackendToolDescriptor,
): Tool.Descriptor<Record<string, unknown>> => {
  // Server's inputSchema (JSON Schema, server-authoritative) is forwarded
  // raw to Bedrock — D14. We don't run Effect-Schema decoding on the
  // input client-side. `description` lives on the Tool.Descriptor (which
  // Bedrock surfaces as `toolSpec.description`); we deliberately don't
  // also stuff it into the inputSchema, since Bedrock would then send it
  // to the LLM twice (once on the toolSpec, once in `inputSchema.json`).
  const retryOnTransport = descriptor.readOnly === true
  return {
    description: descriptor.description,
    schema: descriptor.inputSchema as unknown as Eff.JSONSchema.JsonSchema7Root,
    executor: (args) =>
      callTool(descriptor.name, args, { retryOnTransport }).pipe(
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
    backend: Backend,
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
      const attempt = backend.callTool(name, input).pipe(Eff.Effect.either)
      let result = yield* attempt
      if (
        opts.retryOnTransport &&
        Eff.Either.isLeft(result) &&
        result.left.transient === true
      ) {
        result = yield* attempt
      }
      if (Eff.Either.isLeft(result)) {
        const err = result.left
        if (err.transient === true) {
          yield* Eff.SubscriptionRef.update(health, (h) => ({
            consecutiveFailures: h.consecutiveFailures + 1,
            lastError: err,
          }))
        }
        return Tool.fail(
          Content.ToolResultContentBlock.Text({ text: `${name}: ${err.message}` }),
        )
      }
      yield* resetHealth(health)
      return result.right
    })

/**
 * Bootstrap: `initialize` + `listTools`. No resource autoload — D21.
 * Returns the connector's `Tool.Collection` (keyed `<id>__<name>`).
 */
const bootstrap = (
  config: ConnectorConfig,
  callTool: ConnectorRuntime['callTool'],
): Eff.Effect.Effect<Tool.Collection, BackendError> =>
  Eff.Effect.gen(function* () {
    yield* config.backend.initialize()
    const descriptors = yield* config.backend.listTools()
    const tools: Tool.Collection = {}
    for (const d of descriptors) {
      tools[`${config.id}__${d.name}`] = buildConnectorTool(callTool, d)
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
  backend: Backend,
  health: Eff.SubscriptionRef.SubscriptionRef<Health>,
): Eff.Effect.Effect<never> =>
  Eff.Effect.gen(function* () {
    while (true) {
      yield* Eff.Effect.sleep(HEARTBEAT_CADENCE)
      const result = yield* backend.ping().pipe(
        Eff.Effect.timeoutFail({
          duration: HEARTBEAT_TIMEOUT,
          onTimeout: (): BackendError => transientError('PingTimeout', 'ping timeout'),
        }),
        Eff.Effect.either,
      )
      if (Eff.Either.isLeft(result)) {
        yield* Eff.SubscriptionRef.update(health, (h) => ({
          consecutiveFailures: h.consecutiveFailures + 1,
          lastError: result.left,
        }))
      } else {
        yield* resetHealth(health)
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
 * Probe-driven reconnect (D24, qhq-5d0.6). Pings at escalating cadence
 * (5s → 10s → 20s → 30s cap); each successful ping resets cadence and
 * fires a bootstrap attempt. Up to `RECONNECT_MAX_ATTEMPTS` bootstraps;
 * subsequent failures exhaust the budget. Wrapped in an outer
 * `DISCONNECTED_MAX_DURATION` timeout for the case where ping never
 * succeeds — without it the loop would stay in Disconnected forever.
 *
 * The connector stays in `Disconnected{retrying:true}` throughout — UI
 * shows "reconnecting…". Failure modes: budget exhaustion (returns the
 * last bootstrap error) or the outer timeout (returns a synthetic
 * `DisconnectedTimeout` Transport error).
 */
const runReconnectWithProbe = (
  config: ConnectorConfig,
  callTool: ConnectorRuntime['callTool'],
): Eff.Effect.Effect<Tool.Collection, BackendError> => {
  const escalate = (cadence: Eff.Duration.Duration): Eff.Duration.Duration => {
    const doubled = Eff.Duration.times(cadence, 2)
    return Eff.Duration.greaterThan(doubled, PROBE_CADENCE_MAX)
      ? PROBE_CADENCE_MAX
      : doubled
  }
  return Eff.Effect.gen(function* () {
    let cadence = PROBE_CADENCE_INITIAL
    let bootstrapAttempts = 0
    let lastError: BackendError | null = null
    while (bootstrapAttempts < RECONNECT_MAX_ATTEMPTS) {
      yield* Eff.Effect.sleep(cadence)
      const probe = yield* config.backend.ping().pipe(
        Eff.Effect.timeoutFail({
          duration: HEARTBEAT_TIMEOUT,
          onTimeout: (): BackendError => transientError('PingTimeout', 'ping timeout'),
        }),
        Eff.Effect.either,
      )
      if (Eff.Either.isLeft(probe)) {
        cadence = escalate(cadence)
        continue
      }
      // Transport just confirmed up — reset cadence and attempt bootstrap.
      cadence = PROBE_CADENCE_INITIAL
      bootstrapAttempts += 1
      const attempt = yield* bootstrap(config, callTool).pipe(Eff.Effect.either)
      if (Eff.Either.isRight(attempt)) return attempt.right
      lastError = attempt.left
    }
    return yield* Eff.Effect.fail(
      lastError ?? transientError('ReconnectExhausted', 'reconnect exhausted'),
    )
  }).pipe(
    Eff.Effect.timeoutFail({
      duration: DISCONNECTED_MAX_DURATION,
      onTimeout: (): BackendError =>
        transientError('DisconnectedTimeout', 'reconnect window exhausted'),
    }),
  )
}

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
  state: Eff.SubscriptionRef.SubscriptionRef<ConnectorState>,
  health: Eff.SubscriptionRef.SubscriptionRef<Health>,
  controls: Eff.Queue.Queue<Control>,
  callTool: ConnectorRuntime['callTool'],
): Eff.Effect.Effect<never> =>
  Eff.Effect.gen(function* () {
    while (true) {
      yield* Eff.SubscriptionRef.set(state, ConnectorState.Connecting())
      yield* Eff.SubscriptionRef.set(health, INITIAL_HEALTH)
      const initial = yield* bootstrap(config, callTool).pipe(Eff.Effect.either)
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
        // Reset health BEFORE flipping state to Ready: any tool call
        // observing the Ready transition then sees a clean health
        // counter (no carried-over `consecutiveFailures` from a prior
        // Disconnected cycle).
        yield* Eff.SubscriptionRef.set(health, INITIAL_HEALTH)
        yield* Eff.SubscriptionRef.set(state, ConnectorState.Ready({ tools }))

        // Race: heartbeat loop runs forever; threshold-crossing watcher
        // fires (and wins) when consecutiveFailures ≥ THRESHOLD from any
        // source (heartbeat itself or external tool-call bumps).
        yield* Eff.Effect.race(
          runHeartbeat(config.backend, health),
          awaitThresholdCrossed(health),
        )

        const h = yield* Eff.SubscriptionRef.get(health)
        const degraded =
          h.lastError ?? transientError('HealthDegraded', 'transport health degraded')
        yield* Eff.SubscriptionRef.set(
          state,
          ConnectorState.Disconnected({ retrying: true, error: degraded }),
        )

        const reconnect = yield* runReconnectWithProbe(config, callTool).pipe(
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

/**
 * Build a `ConnectorRuntime` for one config. Allocates per-connector
 * refs + queue, wires the gated `callTool`, and forks the lifecycle
 * fiber under the surrounding scope. The `backend` is sourced from
 * `config.backend` directly — tests construct configs with stub
 * backends; production wires `Mcp.bearerPassthru(...)` (or future
 * factories) at the catalog layer.
 */
export const buildConnectorRuntime = (
  config: ConnectorConfig,
): Eff.Effect.Effect<ConnectorRuntime, never, Eff.Scope.Scope> =>
  Eff.Effect.gen(function* () {
    const state = yield* Eff.SubscriptionRef.make<ConnectorState>(
      ConnectorState.Connecting(),
    )
    const health = yield* Eff.SubscriptionRef.make<Health>(INITIAL_HEALTH)
    const controls = yield* Eff.Queue.unbounded<Control>()
    const callTool = makeConnectorCallTool(config.id, config.backend, state, health)

    yield* Eff.Effect.forkScoped(
      manageConnector(config, state, health, controls, callTool),
    )

    return {
      id: config.id,
      config,
      state,
      // `retry` semantics depend on the current state:
      //
      //  - Failed{!acked}            → drain the controls queue token
      //                                (`awaitRetryControl` listens here)
      //  - Ready / Disconnected      → force a reconnect by degrading
      //                                health to threshold; the Ready
      //                                loop's heartbeat-vs-threshold race
      //                                takes the threshold branch and
      //                                falls into `runReconnectWithProbe`
      //  - Connecting                → already in flight; no-op
      //
      // Without the Ready/Disconnected branch the controls queue is the
      // only path, but it's only consumed from Failed — so a click while
      // healthy went silently nowhere.
      retry: Eff.Effect.gen(function* () {
        const current = yield* Eff.SubscriptionRef.get(state)
        if (current._tag === 'Ready' || current._tag === 'Disconnected') {
          yield* Eff.SubscriptionRef.set(health, {
            consecutiveFailures: HEALTH_THRESHOLD,
            lastError: transientError('UserRetry', 'force reconnect requested'),
          })
        } else {
          yield* Eff.Queue.offer(controls, 'retry')
        }
      }),
      acknowledge: Eff.Queue.offer(controls, 'acknowledge').pipe(Eff.Effect.asVoid),
      callTool,
    }
  })

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
): Eff.Effect.Effect<ConnectorsService, never, Eff.Scope.Scope> =>
  Eff.Effect.gen(function* () {
    const runtimes: Record<ConnectorId, ConnectorRuntime> = {}
    for (const c of configs) {
      runtimes[c.id] = yield* buildConnectorRuntime(c)
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
export const layer = (configs: readonly ConnectorConfig[]): Eff.Layer.Layer<Connectors> =>
  Eff.Layer.scoped(Connectors, buildService(configs))

// ---------------------------------------------------------------------------
// React bridges (D30 — UI reads connector state live)
// ---------------------------------------------------------------------------

// Per-connector subscription: callers use `Actor.useState(connector.state)`
// directly (the ConnectorState ref is the same shape Actor.useState was
// designed for).

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
