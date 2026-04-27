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
    readonly messages: readonly string[]
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
// Layer (skeleton)
// ---------------------------------------------------------------------------

/**
 * Empty placeholder. Step 3 fills in the per-connector lifecycle fiber;
 * step 4 wires the service primitives. Until then this layer satisfies
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
