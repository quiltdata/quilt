/**
 * Connectors lifecycle tests.
 *
 * Scope: state predicates + the per-connector lifecycle (manageConnector
 * via buildConnectorRuntime). Stub the McpClient so transitions are
 * deterministic; use Effect's TestClock for heartbeat time-travel.
 */

import * as Eff from 'effect'
import * as TestClock from 'effect/TestClock'
import * as TestContext from 'effect/TestContext'
import { describe, expect, it } from 'vitest'

import * as Mcp from './Mcp'
import * as Connectors from '.'

const stubClient = (overrides: Partial<Mcp.McpClient> = {}): Mcp.McpClient => ({
  initialize: () => Eff.Effect.void,
  listTools: () => Eff.Effect.succeed([]),
  callTool: () => Eff.Effect.succeed({ content: [] }),
  readResource: () =>
    Eff.Effect.fail(new Mcp.McpProtocolError({ detail: 'stub: not provided' })),
  ping: () => Eff.Effect.void,
  ...overrides,
})

const config: Connectors.ConnectorConfig = {
  id: 'platform',
  title: 'Quilt Platform tools',
  hint: 'Packages, search, S3.',
  transport: Connectors.TransportConfig.Mcp({
    url: 'https://example.invalid/mcp',
    auth: () => Eff.Effect.succeed('token'),
  }),
}

const transportError = new Mcp.McpTransportError({ detail: 'down' })

const runWithTest = <A, E>(
  effect: Eff.Effect.Effect<A, E, Eff.Scope.Scope>,
): Promise<A> =>
  Eff.Effect.runPromise(
    Eff.Effect.scoped(effect).pipe(
      Eff.Effect.provide(TestContext.TestContext),
    ) as Eff.Effect.Effect<A, E, never>,
  )

const awaitState = (
  runtime: Connectors.ConnectorRuntime,
  predicate: (s: Connectors.ConnectorState) => boolean,
): Eff.Effect.Effect<Connectors.ConnectorState> =>
  Eff.pipe(
    runtime.state.changes,
    Eff.Stream.filter(predicate),
    Eff.Stream.take(1),
    Eff.Stream.runHead,
    Eff.Effect.flatMap(
      Eff.Option.match({
        onNone: () => Eff.Effect.die('state stream ended without match'),
        onSome: Eff.Effect.succeed,
      }),
    ),
  )

describe('Connectors', () => {
  describe('state predicates', () => {
    const ready = Connectors.ConnectorState.Ready({ tools: {} })
    const connecting = Connectors.ConnectorState.Connecting()
    const reconnecting = Connectors.ConnectorState.Disconnected({
      retrying: true,
      error: transportError,
    })
    const failedFresh = Connectors.ConnectorState.Failed({
      error: transportError,
      acked: false,
    })
    const failedAcked = Connectors.ConnectorState.Failed({
      error: transportError,
      acked: true,
    })

    const cases: Array<[string, Connectors.ConnectorState, boolean, boolean]> = [
      ['Connecting', connecting, true, false],
      ['Ready', ready, false, false],
      ['Disconnected{retrying:true}', reconnecting, true, false],
      ['Failed{acked:false}', failedFresh, false, true],
      ['Failed{acked:true}', failedAcked, false, false],
    ]

    cases.forEach(([label, state, transient, requiresAck]) => {
      it(`${label}: transient=${transient} requiresAck=${requiresAck} blocked=${transient || requiresAck}`, () => {
        expect(Connectors.stateIsTransient(state)).toBe(transient)
        expect(Connectors.stateRequiresAck(state)).toBe(requiresAck)
        expect(Connectors.stateIsBlocked(state)).toBe(transient || requiresAck)
      })
    })
  })

  describe('lifecycle transitions', () => {
    it('Connecting → Ready when bootstrap succeeds', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              listTools: () =>
                Eff.Effect.succeed([
                  {
                    name: 'foo',
                    description: 'Foo',
                    inputSchema: { type: 'object' },
                  },
                ]),
            }),
          )
          const ready = yield* awaitState(runtime, (s) => s._tag === 'Ready')
          expect(ready._tag).toBe('Ready')
          if (ready._tag !== 'Ready') return
          expect(Object.keys(ready.tools)).toEqual(['platform__foo'])
        }),
      ))

    it('Connecting → Failed{acked:false} when bootstrap fails (no auto-retry on auth)', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              initialize: () => Eff.Effect.fail(new Mcp.McpAuthError()),
            }),
          )
          const failed = yield* awaitState(runtime, (s) => s._tag === 'Failed')
          expect(failed._tag).toBe('Failed')
          if (failed._tag !== 'Failed') return
          expect(failed.acked).toBe(false)
          expect(failed.error._tag).toBe('McpAuthError')
        }),
      ))

    it('retry from Failed → Connecting → Ready on next attempt', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          let attempts = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              initialize: () =>
                Eff.Effect.suspend(() => {
                  attempts += 1
                  return attempts === 1
                    ? Eff.Effect.fail(transportError as Mcp.McpError)
                    : Eff.Effect.void
                }),
            }),
          )
          // wait for first Failed
          yield* awaitState(runtime, (s) => s._tag === 'Failed')
          // user clicks Retry
          yield* runtime.retry
          const ready = yield* awaitState(runtime, (s) => s._tag === 'Ready')
          expect(ready._tag).toBe('Ready')
          expect(attempts).toBeGreaterThanOrEqual(2)
        }),
      ))

    it('acknowledge from Failed{acked:false} → Failed{acked:true}; subsequent retry still works', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          let attempts = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              initialize: () =>
                Eff.Effect.suspend(() => {
                  attempts += 1
                  return attempts === 1
                    ? Eff.Effect.fail(transportError as Mcp.McpError)
                    : Eff.Effect.void
                }),
            }),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Failed')
          yield* runtime.acknowledge
          const acked = yield* awaitState(runtime, (s) => s._tag === 'Failed' && s.acked)
          expect(acked._tag).toBe('Failed')
          if (acked._tag !== 'Failed') return
          expect(acked.acked).toBe(true)
          // user changes mind and clicks Retry — succeeds this time
          yield* runtime.retry
          const ready = yield* awaitState(runtime, (s) => s._tag === 'Ready')
          expect(ready._tag).toBe('Ready')
        }),
      ))
  })

  describe('heartbeat and reconnect (TestClock)', () => {
    it('crosses health threshold via 2 consecutive ping failures → Disconnected', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              ping: () => Eff.Effect.fail(transportError),
            }),
          )
          // wait for bootstrap to succeed
          const reachReady = yield* Eff.Effect.fork(
            awaitState(runtime, (s) => s._tag === 'Ready'),
          )
          yield* Eff.Fiber.join(reachReady)
          // race waits for Disconnected; advance 60s so two heartbeat ticks fire
          const reachDisconnected = yield* Eff.Effect.fork(
            awaitState(runtime, (s) => s._tag === 'Disconnected'),
          )
          yield* TestClock.adjust(Eff.Duration.seconds(60))
          const dc = yield* Eff.Fiber.join(reachDisconnected)
          expect(dc._tag).toBe('Disconnected')
          if (dc._tag !== 'Disconnected') return
          expect(dc.retrying).toBe(true)
          expect(dc.error._tag).toBe('McpTransportError')
        }),
      ))

    it('reconnect exhaustion → Failed{acked:false}', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          // initialize succeeds first time; ping always fails; subsequent
          // initialize calls also fail so reconnect attempts exhaust.
          let bootstraps = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              initialize: () =>
                Eff.Effect.suspend(() => {
                  bootstraps += 1
                  return bootstraps === 1
                    ? Eff.Effect.void
                    : Eff.Effect.fail(transportError as Mcp.McpError)
                }),
              ping: () => Eff.Effect.fail(transportError),
            }),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const reachFailed = yield* Eff.Effect.fork(
            awaitState(runtime, (s) => s._tag === 'Failed'),
          )
          // advance: 2× 30s heartbeat → Disconnected; 1+3+9s reconnect budget
          // exhausts → Failed
          yield* TestClock.adjust(Eff.Duration.seconds(60 + 1 + 3 + 9))
          const failed = yield* Eff.Fiber.join(reachFailed)
          expect(failed._tag).toBe('Failed')
          if (failed._tag !== 'Failed') return
          expect(failed.acked).toBe(false)
          expect(bootstraps).toBe(4) // initial + 3 reconnect attempts
        }),
      ))

    it('reconnect succeeds → returns to Ready', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          let bootstraps = 0
          let pingFailures = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              initialize: () =>
                Eff.Effect.suspend(() => {
                  bootstraps += 1
                  return Eff.Effect.void
                }),
              ping: () =>
                Eff.Effect.suspend(() => {
                  pingFailures += 1
                  return pingFailures <= 2
                    ? Eff.Effect.fail(transportError as Mcp.McpError)
                    : Eff.Effect.void
                }),
            }),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const reachReadyAgain = yield* Eff.Effect.fork(
            Eff.Effect.gen(function* () {
              // wait through Disconnected then back to Ready
              yield* awaitState(runtime, (s) => s._tag === 'Disconnected')
              return yield* awaitState(runtime, (s) => s._tag === 'Ready')
            }),
          )
          // 60s for two ping failures → Disconnected; +1s for first reconnect
          // attempt → Ready (initialize stub never fails so first attempt
          // succeeds).
          yield* TestClock.adjust(Eff.Duration.seconds(61))
          const ready = yield* Eff.Fiber.join(reachReadyAgain)
          expect(ready._tag).toBe('Ready')
          expect(bootstraps).toBe(2) // initial + first reconnect
        }),
      ))
  })

  describe('callTool gating (D27)', () => {
    it('fast-fails when state is not Ready', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              initialize: () => Eff.Effect.fail(new Mcp.McpAuthError()),
              callTool: () =>
                Eff.Effect.die('callTool should not be invoked while not Ready'),
            }),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Failed')
          const result = yield* runtime.callTool('foo', {})
          expect(result.status).toBe('error')
          expect((result.content[0] as { text: string }).text).toContain('platform')
          expect((result.content[0] as { text: string }).text).toContain('Failed')
        }),
      ))

    it('delegates to client.callTool when Ready and maps content', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              callTool: () =>
                Eff.Effect.succeed({
                  content: [{ type: 'text', text: 'hello' } as Mcp.McpContent],
                }),
            }),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const result = yield* runtime.callTool('foo', {})
          expect(result.status).toBe('success')
          expect(result.content).toHaveLength(1)
          expect((result.content[0] as { text: string }).text).toBe('hello')
        }),
      ))

    it('maps tool-side errors to Tool.fail (isError=true)', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              callTool: () =>
                Eff.Effect.succeed({
                  isError: true,
                  content: [{ type: 'text', text: 'boom' } as Mcp.McpContent],
                }),
            }),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const result = yield* runtime.callTool('foo', {})
          expect(result.status).toBe('error')
          expect((result.content[0] as { text: string }).text).toBe('boom')
        }),
      ))

    it('transport error from tool calls bumps health → eventually Disconnected', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            config,
            stubClient({
              ping: () => Eff.Effect.void,
              callTool: () => Eff.Effect.fail(transportError),
            }),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          // two transport-error tool calls bump health past threshold;
          // awaitThresholdCrossed fires synchronously off the SubscriptionRef
          // changes stream — no clock advance needed.
          const reachDisconnected = yield* Eff.Effect.fork(
            awaitState(runtime, (s) => s._tag === 'Disconnected'),
          )
          const r1 = yield* runtime.callTool('foo', {})
          const r2 = yield* runtime.callTool('foo', {})
          expect(r1.status).toBe('error')
          expect(r2.status).toBe('error')
          const dc = yield* Eff.Fiber.join(reachDisconnected)
          expect(dc._tag).toBe('Disconnected')
        }),
      ))
  })
})
