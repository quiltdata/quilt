/**
 * Connectors — registered sources of tools and context for the assistant.
 *
 * A *connector* is the agent-level abstraction (config + state + tools).
 * Lifecycle (Connecting → Ready → Disconnected → Failed, heartbeat,
 * reconnect budget) is generic in `Backend`. Each connector owns its own
 * `SubscriptionRef<ConnectorState>`; the lifecycle fiber writes only to
 * its own ref, and aggregate predicates merge across all per-connector
 * refs.
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
   * `Transport` errors only; false otherwise.
   */
  readonly transient?: boolean
  /**
   * Whether a read-only tool call may retry this error once before
   * reporting it. This is narrower than `transient`: an HTTP 5xx response
   * still indicates degraded transport health, but the server may already
   * have executed the request before returning the response. Defaults to
   * false when omitted.
   */
  readonly retryable?: boolean
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
   * When true, a single transport-level failure is retried once before
   * reporting the error or counting toward the threshold. Destructive
   * tools (or tools without the hint) fail immediately.
   */
  readonly readOnly?: boolean
}

/**
 * Application-driven resource entry. The catalog enumerates resources
 * at bootstrap and surfaces the directory in the connector overview.
 * Content is fetched on demand via `get_resource` by default; URIs in
 * `ConnectorConfig.autoload` are pre-fetched at bootstrap and inlined
 * into the prompt for reference-grade resources the model
 * demonstrably doesn't fetch on its own (e.g. ES query syntax).
 *
 * `content` is populated only for autoloaded entries.
 */
export interface BackendResourceDescriptor {
  readonly uri: string
  readonly name?: string
  readonly description?: string
  readonly mimeType?: string
  readonly content?: string
}

/**
 * The connector's behavioral surface. Implementations adapt a wire
 * protocol (today: 1st-party MCP via `Mcp.bearerPassthru`) into this
 * interface; the lifecycle is fully generic in `Backend`.
 */
export interface Backend {
  readonly initialize: () => Eff.Effect.Effect<void, BackendError>
  readonly listTools: () => Eff.Effect.Effect<
    readonly BackendToolDescriptor[],
    BackendError
  >
  readonly listResources: () => Eff.Effect.Effect<
    readonly BackendResourceDescriptor[],
    BackendError
  >
  /**
   * Fetch a resource's content as a single text blob. Concatenates all
   * text parts from the wire response; binary parts are skipped. Used
   * by bootstrap for autoloaded resources.
   */
  readonly readResource: (uri: string) => Eff.Effect.Effect<string, BackendError>
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
 * Connector configuration — title, hint, the backend instance the
 * lifecycle drives, and the optional set of resource URIs to autoload
 * at bootstrap.
 *
 * Reference-grade resources the model demonstrably won't fetch on its
 * own (search syntax, Athena schema) belong in `autoload`. Stack state
 * already covered elsewhere or rarely-needed identity does not.
 */
export interface ConnectorConfig {
  readonly id: ConnectorId
  readonly title: string
  readonly hint?: string
  readonly backend: Backend
  readonly autoload?: ReadonlySet<string>
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Per-connector state machine:
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
    readonly resources: readonly BackendResourceDescriptor[]
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
 * Optional knobs for one tool-call invocation. `retryOnTransport`:
 * when true, a single transport-level failure is retried before
 * reporting the error and bumping the health counter.
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
// Lifecycle internals
// ---------------------------------------------------------------------------

/**
 * Heartbeat cadence + timeout + threshold. Both ping failures and
 * tool-call transport failures contribute to `Health.consecutiveFailures`;
 * crossing the threshold flips the state to Disconnected and starts the
 * reconnect probe loop.
 */
const HEARTBEAT_CADENCE = Eff.Duration.seconds(30)
const HEARTBEAT_TIMEOUT = Eff.Duration.seconds(5)
const HEALTH_THRESHOLD = 2
const BOOTSTRAP_TIMEOUT = Eff.Duration.seconds(60)

/**
 * Disconnected-mode probe parameters. The lifecycle pings at escalating
 * cadence (`PROBE_CADENCE_INITIAL`, doubled each failure, capped at
 * `PROBE_CADENCE_MAX`); each successful ping triggers a bootstrap
 * attempt (cap: `RECONNECT_MAX_ATTEMPTS`). If ping never succeeds
 * within `DISCONNECTED_MAX_DURATION`, fail with a synthetic
 * `DisconnectedTimeout` `Transport` error.
 */
const PROBE_CADENCE_INITIAL = Eff.Duration.seconds(5)
const PROBE_CADENCE_MAX = Eff.Duration.seconds(30)
const RECONNECT_MAX_ATTEMPTS = 3
const DISCONNECTED_MAX_DURATION = Eff.Duration.seconds(60)

/**
 * Per-resource size cap for autoload. Resources whose content exceeds
 * this byte count are dropped from the autoload path and stay listed as
 * attribute-only entries — the model can still fetch them on demand
 * via `get_resource`.
 */
const AUTOLOAD_MAX_BYTES = 16 * 1024

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
  retryable: false,
  cause,
})

type Control = 'retry' | 'acknowledge'

/**
 * Build a `Tool.Descriptor` whose executor routes through the
 * connector's gated `callTool` (fast-fail when not Ready). Tools marked
 * `readOnly` auto-retry once on transport error; tools without the
 * hint fail immediately on the first transport failure.
 */
const buildConnectorTool = (
  callTool: ConnectorRuntime['callTool'],
  descriptor: BackendToolDescriptor,
): Tool.Descriptor<Record<string, unknown>> => {
  // Forward the server's `inputSchema` raw to Bedrock; we don't run
  // Effect-Schema decoding on the input client-side. `description` lives
  // on `Tool.Descriptor` (Bedrock surfaces it as `toolSpec.description`);
  // we keep it out of `inputSchema` so it doesn't ship twice.
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
 * and updates the shared health ref on transport-level outcome.
 * Non-transport (e.g. server-side application) errors don't disturb
 * health.
 *
 * `retryOnTransport` (set by `buildConnectorTool` for read-only tools)
 * triggers a single re-attempt on the first transport failure before
 * reporting the error; only the second attempt's outcome hits health.
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
        result.left.retryable === true
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
 * Bootstrap: `initialize` + `listTools` + `listResources` + autoload
 * pre-fetch. For URIs in `config.autoload`, the content is fetched and
 * inlined into the descriptor.
 *
 * `listResources` and per-URI `readResource` are best-effort —
 * `listTools` already proved transport/auth, so a downstream hiccup
 * shouldn't block Ready. Failures fall through to an empty directory
 * or attribute-only entry. Same fallback when a resource exceeds
 * `AUTOLOAD_MAX_BYTES`.
 *
 * Returns the tool collection (keyed `<id>__<name>`) and resource
 * directory.
 */
interface BootstrapResult {
  readonly tools: Tool.Collection
  readonly resources: readonly BackendResourceDescriptor[]
}
const bootstrap = (
  config: ConnectorConfig,
  callTool: ConnectorRuntime['callTool'],
): Eff.Effect.Effect<BootstrapResult, BackendError> =>
  Eff.Effect.gen(function* () {
    yield* config.backend.initialize()
    const descriptors = yield* config.backend.listTools()
    const tools: Tool.Collection = {}
    for (const d of descriptors) {
      tools[`${config.id}__${d.name}`] = buildConnectorTool(callTool, d)
    }
    const listed = yield* config.backend
      .listResources()
      .pipe(
        Eff.Effect.catchAll(() =>
          Eff.Effect.succeed([] as readonly BackendResourceDescriptor[]),
        ),
      )
    const autoload = config.autoload ?? new Set<string>()
    const resources = yield* Eff.Effect.all(
      listed.map((d) =>
        autoload.has(d.uri) ? attachAutoloadedContent(config, d) : Eff.Effect.succeed(d),
      ),
      { concurrency: 'unbounded' },
    )
    return { tools, resources }
  })

/**
 * Pre-fetch a resource's content for autoload. Drops the content
 * (keeping the descriptor) on read failure or if the body exceeds
 * `AUTOLOAD_MAX_BYTES`. Never fails — bootstrap stays best-effort.
 */
const attachAutoloadedContent = (
  config: ConnectorConfig,
  descriptor: BackendResourceDescriptor,
): Eff.Effect.Effect<BackendResourceDescriptor> =>
  config.backend.readResource(descriptor.uri).pipe(
    Eff.Effect.flatMap((content) =>
      content.length > AUTOLOAD_MAX_BYTES
        ? Eff.Effect.logWarning(
            `[Connectors:${config.id}] resource ${descriptor.uri} exceeds autoload cap ` +
              `(${content.length} > ${AUTOLOAD_MAX_BYTES}); dropped to on-demand path`,
          ).pipe(Eff.Effect.as(descriptor))
        : Eff.Effect.succeed({ ...descriptor, content }),
    ),
    Eff.Effect.catchAll((err) =>
      Eff.Effect.logWarning(
        `[Connectors:${config.id}] autoload of ${descriptor.uri} failed: ${err.message}`,
      ).pipe(Eff.Effect.as(descriptor)),
    ),
  )

/**
 * Race a sleep against the wake stream — either the cadence elapses or
 * page activity fires. Used in heartbeat and reconnect-probe loops so a
 * suspended tab (laptop closed, hidden tab) checks connectivity
 * immediately on resume rather than waiting for the next scheduled tick.
 */
const sleepOrWake = (
  duration: Eff.Duration.Duration,
  wake: Eff.Stream.Stream<void>,
): Eff.Effect.Effect<void> =>
  Eff.Effect.race(
    Eff.Effect.sleep(duration),
    wake.pipe(Eff.Stream.take(1), Eff.Stream.runDrain),
  )

/**
 * Heartbeat ping loop. Runs forever; each tick pings with timeout and
 * updates `health` on outcome. Tool-call transport failures bump the
 * same counter externally; `awaitThresholdCrossed` watches the shared
 * ref and fires when the threshold crosses, regardless of source.
 *
 * The cadence sleep races against `wake` (page-activity signal). When
 * the tab resumes from hidden/suspended, the heartbeat re-checks the
 * connector immediately rather than waiting up to 30s for the in-flight
 * sleep timer to fire.
 */
const runHeartbeat = (
  backend: Backend,
  health: Eff.SubscriptionRef.SubscriptionRef<Health>,
  wake: Eff.Stream.Stream<void>,
): Eff.Effect.Effect<never> =>
  Eff.Effect.gen(function* () {
    while (true) {
      yield* sleepOrWake(HEARTBEAT_CADENCE, wake)
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
 * Probe-driven reconnect. Pings at escalating cadence
 * (5s → 10s → 20s → 30s cap); each successful ping resets cadence and
 * fires a bootstrap attempt. Up to `RECONNECT_MAX_ATTEMPTS` bootstraps;
 * subsequent failures exhaust the budget. Wrapped in an outer
 * `DISCONNECTED_MAX_DURATION` timeout — without it the loop would stay
 * in Disconnected forever if ping never succeeds.
 *
 * The connector stays in `Disconnected{retrying:true}` throughout.
 * Failure modes: budget exhaustion (returns the last bootstrap error)
 * or outer timeout (returns a synthetic `DisconnectedTimeout`).
 */
const runReconnectWithProbe = (
  config: ConnectorConfig,
  callTool: ConnectorRuntime['callTool'],
  wake: Eff.Stream.Stream<void>,
): Eff.Effect.Effect<BootstrapResult, BackendError> => {
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
      yield* sleepOrWake(cadence, wake)
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
 * Long-running connector lifecycle. Sole writer to `state`. Loops:
 * Connecting → (Ready loop with heartbeat + reconnect budget) → Failed
 * → wait for retry → repeat. Interrupted on Layer release.
 */
export const manageConnector = (
  config: ConnectorConfig,
  state: Eff.SubscriptionRef.SubscriptionRef<ConnectorState>,
  health: Eff.SubscriptionRef.SubscriptionRef<Health>,
  controls: Eff.Queue.Queue<Control>,
  callTool: ConnectorRuntime['callTool'],
  wake: Eff.Stream.Stream<void> = Eff.Stream.never,
): Eff.Effect.Effect<never> =>
  Eff.Effect.gen(function* () {
    while (true) {
      yield* Eff.SubscriptionRef.set(state, ConnectorState.Connecting())
      yield* resetHealth(health)
      const initial = yield* bootstrap(config, callTool).pipe(
        Eff.Effect.timeoutFail({
          duration: BOOTSTRAP_TIMEOUT,
          onTimeout: (): BackendError =>
            transientError('ConnectingTimeout', 'initial connection timed out'),
        }),
        Eff.Effect.either,
      )
      if (Eff.Either.isLeft(initial)) {
        yield* Eff.SubscriptionRef.set(
          state,
          ConnectorState.Failed({ error: initial.left, acked: false }),
        )
        yield* awaitRetryControl(state, controls)
        continue
      }

      let { tools, resources } = initial.right
      let inReady = true
      while (inReady) {
        // Reset health BEFORE flipping state to Ready: any tool call
        // observing the Ready transition then sees a clean health
        // counter (no carried-over `consecutiveFailures` from a prior
        // Disconnected cycle).
        yield* resetHealth(health)
        yield* Eff.SubscriptionRef.set(state, ConnectorState.Ready({ tools, resources }))

        // Race: heartbeat loop runs forever; threshold-crossing watcher
        // fires (and wins) when consecutiveFailures ≥ THRESHOLD from any
        // source (heartbeat itself or external tool-call bumps).
        yield* Eff.Effect.race(
          runHeartbeat(config.backend, health, wake),
          awaitThresholdCrossed(health),
        )

        const h = yield* Eff.SubscriptionRef.get(health)
        const degraded =
          h.lastError ?? transientError('HealthDegraded', 'transport health degraded')
        yield* Eff.SubscriptionRef.set(
          state,
          ConnectorState.Disconnected({ retrying: true, error: degraded }),
        )

        const reconnect = yield* runReconnectWithProbe(config, callTool, wake).pipe(
          Eff.Effect.either,
        )
        if (Eff.Either.isRight(reconnect)) {
          tools = reconnect.right.tools
          resources = reconnect.right.resources
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
  wake: Eff.Stream.Stream<void> = Eff.Stream.never,
): Eff.Effect.Effect<ConnectorRuntime, never, Eff.Scope.Scope> =>
  Eff.Effect.gen(function* () {
    const state = yield* Eff.SubscriptionRef.make<ConnectorState>(
      ConnectorState.Connecting(),
    )
    const health = yield* Eff.SubscriptionRef.make<Health>(INITIAL_HEALTH)
    const controls = yield* Eff.Queue.unbounded<Control>()
    const callTool = makeConnectorCallTool(config.id, config.backend, state, health)

    yield* Eff.Effect.forkScoped(
      manageConnector(config, state, health, controls, callTool, wake),
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
        } else if (current._tag === 'Failed') {
          yield* Eff.Queue.offer(controls, 'retry')
        }
      }),
      acknowledge: Eff.Queue.offer(controls, 'acknowledge').pipe(Eff.Effect.asVoid),
      callTool,
    }
  })

// ---------------------------------------------------------------------------
// Connectors overview rendering
// ---------------------------------------------------------------------------

/**
 * Render the resource directory as a nested `<resources>` block.
 * Default: each entry is attribute-only and the model fetches content
 * on demand via `get_resource`. Autoloaded entries carry their content
 * as the element body so it lands in the prompt without a tool
 * round-trip.
 */
const renderResources = (
  resources: readonly BackendResourceDescriptor[],
): XML.Tag | null => {
  if (resources.length === 0) return null
  const entries = resources.map((r) => {
    const attrs = {
      uri: r.uri,
      ...(r.name ? { name: r.name } : {}),
      ...(r.mimeType ? { 'mime-type': r.mimeType } : {}),
      ...(r.description ? { description: r.description } : {}),
    }
    return r.content !== undefined
      ? XML.tag('resource', attrs, r.content)
      : XML.tag('resource', attrs)
  })
  return XML.tag('resources', {}, ...entries)
}

/**
 * Render one `<connector>` element for the LLM-facing overview. Only
 * stable states reach the prompt:
 *
 *  - `Ready`           → `state="ready"`, hint as body, resource
 *                        directory as a nested `<resources>` block
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
    const children: (string | XML.Tag)[] = []
    if (config.hint) children.push(config.hint)
    const resources = renderResources(state.resources)
    if (resources) children.push(resources)
    return XML.tag('connector', { ...baseAttrs, state: 'ready' }, ...children).toString()
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
// Page-activity wake stream
// ---------------------------------------------------------------------------

/**
 * Wake signal for sleep-bound lifecycle loops (heartbeat + reconnect
 * probe). Emits whenever the tab transitions to `visibilityState ===
 * 'visible'` (laptop reopened, tab returned to foreground, browser
 * un-suspended) or the browser fires `online` (network recovered).
 *
 * Without this, a long sleep timer that gets frozen during suspend
 * means the heartbeat doesn't tick until the sleep timer eventually
 * fires post-resume — which can be ≫30s after the user is back. With
 * the wake signal, the in-flight sleep is race-cancelled and ping
 * fires immediately on resume.
 *
 * Single PubSub fed by one set of DOM listeners; `Stream.fromPubSub`
 * fans out to per-connector consumers. Listeners are detached when
 * the surrounding `Scope` closes (Assistant unmount).
 *
 * SSR-safe: returns `Stream.never` if `document` / `window` aren't in
 * scope.
 */
const makeWakeStream = (): Eff.Effect.Effect<
  Eff.Stream.Stream<void>,
  never,
  Eff.Scope.Scope
> =>
  Eff.Effect.gen(function* () {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return Eff.Stream.never
    }
    const hub = yield* Eff.PubSub.unbounded<void>()
    yield* Eff.Effect.acquireRelease(
      Eff.Effect.sync(() => {
        const fire = () => runtime.runFork(Eff.PubSub.publish(hub, undefined as void))
        const onVisible = () => {
          if (document.visibilityState === 'visible') fire()
        }
        const onOnline = () => fire()
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('online', onOnline)
        return { onVisible, onOnline }
      }),
      (handlers) =>
        Eff.Effect.sync(() => {
          document.removeEventListener('visibilitychange', handlers.onVisible)
          window.removeEventListener('online', handlers.onOnline)
        }),
    )
    return Eff.Stream.fromPubSub(hub)
  })

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
 * fibers are interrupted on scope release (Assistant unmount).
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
    const wake = yield* makeWakeStream()
    const runtimes: Record<ConnectorId, ConnectorRuntime> = {}
    for (const c of configs) {
      runtimes[c.id] = yield* buildConnectorRuntime(c, wake)
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
// React bridges
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
