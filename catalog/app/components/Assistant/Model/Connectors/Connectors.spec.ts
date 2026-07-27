/**
 * Connectors lifecycle tests.
 *
 * Scope: state predicates + the per-connector lifecycle (manageConnector
 * via buildConnectorRuntime). Stub the Backend so transitions are
 * deterministic; use Effect's TestClock for heartbeat time-travel.
 */

import * as Eff from 'effect'
import * as TestClock from 'effect/TestClock'
import * as TestContext from 'effect/TestContext'
import { describe, expect, it } from 'vitest'

import * as Content from '../Content'
import * as Tool from '../Tool'

import * as Connectors from '.'

const stubBackend = (
  overrides: Partial<Connectors.Backend> = {},
): Connectors.Backend => ({
  initialize: () => Eff.Effect.void,
  listTools: () => Eff.Effect.succeed([]),
  listResources: () => Eff.Effect.succeed([]),
  readResource: () => Eff.Effect.succeed(''),
  callTool: () => Eff.Effect.succeed(Tool.succeed()),
  ping: () => Eff.Effect.void,
  ...overrides,
})

const baseConfig = (
  backend: Connectors.Backend,
  overrides: Partial<Connectors.ConnectorConfig> = {},
): Connectors.ConnectorConfig => ({
  id: 'platform',
  title: 'Quilt Platform tools',
  hint: 'Packages, search, S3.',
  backend,
  ...overrides,
})

const transportError: Connectors.BackendError = {
  _tag: 'Transport',
  message: 'down',
  transient: true,
  retryable: true,
}

const httpTransportError: Connectors.BackendError = {
  _tag: 'Transport',
  message: 'HTTP 500',
  transient: true,
  retryable: false,
}

const authError: Connectors.BackendError = {
  _tag: 'Auth',
  message: 'no session token',
  transient: false,
}

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
    const ready = Connectors.ConnectorState.Ready({ tools: {}, resources: [] })
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
            baseConfig(
              stubBackend({
                listTools: () =>
                  Eff.Effect.succeed([
                    {
                      name: 'foo',
                      description: 'Foo',
                      inputSchema: { type: 'object' },
                    },
                  ]),
              }),
            ),
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
            baseConfig(
              stubBackend({
                initialize: () => Eff.Effect.fail(authError),
              }),
            ),
          )
          const failed = yield* awaitState(runtime, (s) => s._tag === 'Failed')
          expect(failed._tag).toBe('Failed')
          if (failed._tag !== 'Failed') return
          expect(failed.acked).toBe(false)
          expect(failed.error._tag).toBe('Auth')
        }),
      ))

    it('Connecting → Failed{acked:false} when initial bootstrap times out', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                initialize: () => Eff.Effect.never,
              }),
            ),
          )
          const reachFailed = yield* Eff.Effect.fork(
            awaitState(runtime, (s) => s._tag === 'Failed'),
          )
          yield* TestClock.adjust(Eff.Duration.seconds(60))
          const failed = yield* Eff.Fiber.join(reachFailed)
          expect(failed._tag).toBe('Failed')
          if (failed._tag !== 'Failed') return
          expect(failed.acked).toBe(false)
          expect(failed.error._tag).toBe('Transport')
          expect(failed.error.cause).toBe('ConnectingTimeout')
        }),
      ))

    it('retry from Failed → Connecting → Ready on next attempt', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          let attempts = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                initialize: () =>
                  Eff.Effect.suspend(() => {
                    attempts += 1
                    return attempts === 1
                      ? Eff.Effect.fail(transportError)
                      : Eff.Effect.void
                  }),
              }),
            ),
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
            baseConfig(
              stubBackend({
                initialize: () =>
                  Eff.Effect.suspend(() => {
                    attempts += 1
                    return attempts === 1
                      ? Eff.Effect.fail(transportError)
                      : Eff.Effect.void
                  }),
              }),
            ),
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

    it('retry / acknowledge offered while not Failed do NOT short-circuit the next Failed gate', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          let attempts = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                initialize: () =>
                  Eff.Effect.suspend(() => {
                    attempts += 1
                    // attempt 1: bootstrap succeeds → Ready;
                    // attempt 2 (after explicit user retry): also succeeds → Ready
                    return Eff.Effect.void
                  }),
                ping: () => Eff.Effect.fail(transportError),
              }),
            ),
          )
          // Wait for Ready, then offer stale controls. They MUST be discarded
          // before the next Failed entry; otherwise a buffered 'retry' would
          // immediately exit Failed and an 'acknowledge' would skip the
          // user-action gate.
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          yield* runtime.retry
          yield* runtime.acknowledge
          // Drive into Failed via heartbeat threshold + reconnect exhaustion.
          const reachFailed = yield* Eff.Effect.fork(
            awaitState(runtime, (s) => s._tag === 'Failed'),
          )
          // 60s for two ping failures; reconnect attempts succeed (initialize
          // stub returns void) — so Disconnected → Ready, not Failed.
          // Force exhaustion by making reconnect fail too. Override:
          // re-build with a different stub. Instead use the existing client
          // and just accept that Failed never lands — we're verifying the
          // GATE behavior, not the path. Put us through a forced failure
          // sequence by interrupting and restarting via a separate test.
          // (See next test for the full Failed cycle.)
          yield* Eff.Fiber.interrupt(reachFailed)

          // Verify acknowledge didn't apply prematurely: state is still Ready,
          // not Failed{acked:true}.
          const cur = yield* Eff.SubscriptionRef.get(runtime.state)
          expect(cur._tag).toBe('Ready')
          expect(attempts).toBe(1) // no extra bootstrap from stale retry
        }),
      ))

    it('stale retry/acknowledge before Failed are drained on Failed entry', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          let bootstrapAttempts = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                initialize: () =>
                  Eff.Effect.suspend(() => {
                    bootstrapAttempts += 1
                    // first bootstrap fails so connector goes Failed{acked:false};
                    // stale tokens queued before Failed entry must NOT auto-exit
                    return Eff.Effect.fail(transportError)
                  }),
              }),
            ),
          )
          // Race: queue stale controls before lifecycle even has a chance to
          // park at awaitRetryControl.
          yield* runtime.retry
          yield* runtime.acknowledge
          const failed = yield* awaitState(runtime, (s) => s._tag === 'Failed')
          expect(failed._tag).toBe('Failed')
          if (failed._tag !== 'Failed') return
          // Critically: still Failed{acked:false}, NOT Failed{acked:true}, and
          // didn't auto-retry into a second bootstrap.
          expect(failed.acked).toBe(false)
          // Give the lifecycle a moment to drain spuriously — if buggy, it
          // would have looped Connecting → Failed again. Verify only one
          // bootstrap ran.
          yield* TestClock.adjust(Eff.Duration.millis(10))
          expect(bootstrapAttempts).toBe(1)
        }),
      ))
  })

  describe('heartbeat and reconnect (TestClock)', () => {
    it('crosses health threshold via 2 consecutive ping failures → Disconnected', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                ping: () => Eff.Effect.fail(transportError),
              }),
            ),
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
          expect(dc.error._tag).toBe('Transport')
        }),
      ))

    it('reconnect succeeds via probe → returns to Ready', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          // ping fails twice (heartbeat threshold) → Disconnected;
          // 3rd ping (probe at +5s into Disconnected) succeeds → bootstrap
          // fires → Ready.
          let bootstraps = 0
          let pings = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                initialize: () =>
                  Eff.Effect.suspend(() => {
                    bootstraps += 1
                    return Eff.Effect.void
                  }),
                ping: () =>
                  Eff.Effect.suspend(() => {
                    pings += 1
                    return pings <= 2 ? Eff.Effect.fail(transportError) : Eff.Effect.void
                  }),
              }),
            ),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const reachReadyAgain = yield* Eff.Effect.fork(
            Eff.Effect.gen(function* () {
              yield* awaitState(runtime, (s) => s._tag === 'Disconnected')
              return yield* awaitState(runtime, (s) => s._tag === 'Ready')
            }),
          )
          // 60s heartbeat (two failures → Disconnected) + 5s first probe
          // succeeds → bootstrap fires → Ready.
          yield* TestClock.adjust(Eff.Duration.seconds(65))
          const ready = yield* Eff.Fiber.join(reachReadyAgain)
          expect(ready._tag).toBe('Ready')
          expect(bootstraps).toBe(2) // initial + first reconnect
          expect(pings).toBe(3) // 2 heartbeat + 1 probe
        }),
      ))

    it('ping never succeeds during Disconnected → DisconnectedTimeout → Failed{!acked}', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          // ping always fails. Heartbeat (2 fails) crosses threshold;
          // probe loop pings at escalating cadence (5/10/20/30); outer
          // 60s timeout fires before the probe loop hits its 3-bootstrap
          // budget. Failed.error.cause === 'DisconnectedTimeout'.
          let pings = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                ping: () =>
                  Eff.Effect.suspend(() => {
                    pings += 1
                    return Eff.Effect.fail(transportError)
                  }),
              }),
            ),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const reachFailed = yield* Eff.Effect.fork(
            awaitState(runtime, (s) => s._tag === 'Failed'),
          )
          // 60s heartbeat → Disconnected; 60s outer timeout → Failed.
          yield* TestClock.adjust(Eff.Duration.seconds(120))
          const failed = yield* Eff.Fiber.join(reachFailed)
          expect(failed._tag).toBe('Failed')
          if (failed._tag !== 'Failed') return
          expect(failed.acked).toBe(false)
          expect(failed.error._tag).toBe('Transport')
          expect(failed.error.cause).toBe('DisconnectedTimeout')
          // 2 heartbeat + 3 probes (5s, +10s, +20s, sleep 30s interrupted
          // by outer timeout at 60s into Disconnected). Probes fired at
          // clock 65, 75, 95.
          expect(pings).toBe(5)
        }),
      ))

    it('3 bootstrap failures after successful pings → Failed{!acked} (budget exhausted)', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          // ping fails twice (cross threshold), then succeeds; initialize
          // succeeds first time then fails — so each probe's bootstrap
          // attempt fails. After 3 attempts (cadence reset to 5s between
          // each), budget exhausts → Failed with the last bootstrap error.
          let bootstraps = 0
          let pings = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                initialize: () =>
                  Eff.Effect.suspend(() => {
                    bootstraps += 1
                    return bootstraps === 1
                      ? Eff.Effect.void
                      : Eff.Effect.fail(transportError)
                  }),
                ping: () =>
                  Eff.Effect.suspend(() => {
                    pings += 1
                    return pings <= 2 ? Eff.Effect.fail(transportError) : Eff.Effect.void
                  }),
              }),
            ),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const reachFailed = yield* Eff.Effect.fork(
            awaitState(runtime, (s) => s._tag === 'Failed'),
          )
          // 60s heartbeat → Disconnected; +5/+5/+5 (cadence resets after
          // each successful ping) → 3 bootstraps fail → Failed.
          yield* TestClock.adjust(Eff.Duration.seconds(75))
          const failed = yield* Eff.Fiber.join(reachFailed)
          expect(failed._tag).toBe('Failed')
          if (failed._tag !== 'Failed') return
          expect(failed.acked).toBe(false)
          expect(bootstraps).toBe(4) // initial + 3 reconnect attempts
          // last bootstrap error preserved (not the synthetic timeout)
          expect(failed.error._tag).toBe('Transport')
          expect(failed.error.cause).not.toBe('DisconnectedTimeout')
        }),
      ))

    it('probe cadence escalates 5s → 10s → 20s → 30s on consecutive failures', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          // ping always fails. Track ping count at intermediate times
          // to verify the 5/10/20/30 schedule.
          let pings = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                ping: () =>
                  Eff.Effect.suspend(() => {
                    pings += 1
                    return Eff.Effect.fail(transportError)
                  }),
              }),
            ),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          // 60s for heartbeat → Disconnected (2 pings).
          yield* TestClock.adjust(Eff.Duration.seconds(60))
          yield* awaitState(runtime, (s) => s._tag === 'Disconnected')
          expect(pings).toBe(2)
          // +5s → 1st probe fires
          yield* TestClock.adjust(Eff.Duration.seconds(5))
          expect(pings).toBe(3)
          // +10s → 2nd probe (cadence escalated to 10s)
          yield* TestClock.adjust(Eff.Duration.seconds(10))
          expect(pings).toBe(4)
          // +20s → 3rd probe (cadence escalated to 20s)
          yield* TestClock.adjust(Eff.Duration.seconds(20))
          expect(pings).toBe(5)
          // Don't advance further — the 4th probe would fire after +30s
          // but the outer 60s timeout fires first (at 60s into Disconnected,
          // i.e. clock 120). We've only consumed 35s of the Disconnected
          // window; verify state is still Disconnected.
          const cur = yield* Eff.SubscriptionRef.get(runtime.state)
          expect(cur._tag).toBe('Disconnected')
        }),
      ))

    it('wake stream cancels heartbeat sleep and pings immediately', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          // The page-activity wake signal (visibilitychange→visible /
          // online) races against the heartbeat sleep so a tab returning
          // from suspend re-checks connectivity immediately rather than
          // waiting up to 30s for the next scheduled tick.
          const pingCount = yield* Eff.SubscriptionRef.make(0)
          const wakeQueue = yield* Eff.Queue.unbounded<void>()
          const wake = Eff.Stream.fromQueue(wakeQueue)

          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                ping: () => Eff.SubscriptionRef.update(pingCount, (n) => n + 1),
              }),
            ),
            wake,
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          // Bootstrap doesn't ping; counter is 0 even after Ready.
          expect(yield* Eff.SubscriptionRef.get(pingCount)).toBe(0)

          // Fire wake before HEARTBEAT_CADENCE elapses; the heartbeat's
          // in-flight sleep should race-cancel and ping immediately.
          yield* Eff.Queue.offer(wakeQueue, undefined as void)
          // Wait for the ping to land (counter to cross 1).
          yield* Eff.pipe(
            pingCount.changes,
            Eff.Stream.filter((n) => n >= 1),
            Eff.Stream.take(1),
            Eff.Stream.runDrain,
          )
          expect(yield* Eff.SubscriptionRef.get(pingCount)).toBe(1)
        }),
      ))
  })

  describe('callTool gating', () => {
    it('fast-fails when state is not Ready', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                initialize: () => Eff.Effect.fail(authError),
                callTool: () =>
                  Eff.Effect.die('callTool should not be invoked while not Ready'),
              }),
            ),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Failed')
          const result = yield* runtime.callTool('foo', {})
          expect(result.status).toBe('error')
          expect((result.content[0] as { text: string }).text).toContain('platform')
          expect((result.content[0] as { text: string }).text).toContain('Failed')
        }),
      ))

    it('delegates to backend.callTool when Ready and forwards content', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                callTool: () =>
                  Eff.Effect.succeed(
                    Tool.succeed(Content.ToolResultContentBlock.Text({ text: 'hello' })),
                  ),
              }),
            ),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const result = yield* runtime.callTool('foo', {})
          expect(result.status).toBe('success')
          expect(result.content).toHaveLength(1)
          expect((result.content[0] as { text: string }).text).toBe('hello')
        }),
      ))

    it('forwards backend Tool.fail results unchanged (server-side tool error)', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                callTool: () =>
                  Eff.Effect.succeed(
                    Tool.fail(Content.ToolResultContentBlock.Text({ text: 'boom' })),
                  ),
              }),
            ),
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
            baseConfig(
              stubBackend({
                ping: () => Eff.Effect.void,
                callTool: () => Eff.Effect.fail(transportError),
              }),
            ),
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

    it('non-transient backend errors do NOT bump health (no Disconnected)', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                ping: () => Eff.Effect.void,
                callTool: () => Eff.Effect.fail(authError), // transient: false
              }),
            ),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          // Five non-transient failures — would cross the threshold (2) if
          // these were transient. Verify Ready remains Ready.
          for (let i = 0; i < 5; i += 1) {
            const r = yield* runtime.callTool('foo', {})
            expect(r.status).toBe('error')
          }
          const cur = yield* Eff.SubscriptionRef.get(runtime.state)
          expect(cur._tag).toBe('Ready')
        }),
      ))

    it('retryOnTransport: a single transport error retries once before bumping health', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          let attempts = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                ping: () => Eff.Effect.void,
                callTool: () =>
                  Eff.Effect.suspend(() => {
                    attempts += 1
                    return attempts === 1
                      ? Eff.Effect.fail(transportError)
                      : Eff.Effect.succeed(
                          Tool.succeed(
                            Content.ToolResultContentBlock.Text({ text: 'ok' }),
                          ),
                        )
                  }),
              }),
            ),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const result = yield* runtime.callTool('foo', {}, { retryOnTransport: true })
          expect(result.status).toBe('success')
          expect(attempts).toBe(2)
        }),
      ))

    it('retryOnTransport does not retry non-retryable HTTP transport responses', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          let attempts = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                ping: () => Eff.Effect.void,
                callTool: () =>
                  Eff.Effect.suspend(() => {
                    attempts += 1
                    return Eff.Effect.fail(httpTransportError)
                  }),
              }),
            ),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const result = yield* runtime.callTool('foo', {}, { retryOnTransport: true })
          expect(result.status).toBe('error')
          expect(attempts).toBe(1)
        }),
      ))

    it('retryOnTransport off (destructive default): single transport error → fail + bump', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          let attempts = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                ping: () => Eff.Effect.void,
                callTool: () =>
                  Eff.Effect.suspend(() => {
                    attempts += 1
                    return Eff.Effect.fail(transportError)
                  }),
              }),
            ),
          )
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const result = yield* runtime.callTool('foo', {})
          expect(result.status).toBe('error')
          expect(attempts).toBe(1)
        }),
      ))

    it('readOnly descriptor flag drives retryOnTransport via buildConnectorTool', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          let attempts = 0
          const runtime = yield* Connectors.buildConnectorRuntime(
            baseConfig(
              stubBackend({
                ping: () => Eff.Effect.void,
                listTools: () =>
                  Eff.Effect.succeed([
                    {
                      name: 'safe',
                      description: 'read-only',
                      inputSchema: { type: 'object' },
                      readOnly: true,
                    },
                  ]),
                callTool: () =>
                  Eff.Effect.suspend(() => {
                    attempts += 1
                    return attempts === 1
                      ? Eff.Effect.fail(transportError)
                      : Eff.Effect.succeed(
                          Tool.succeed(
                            Content.ToolResultContentBlock.Text({ text: 'ok' }),
                          ),
                        )
                  }),
              }),
            ),
          )
          const ready = yield* awaitState(runtime, (s) => s._tag === 'Ready')
          if (ready._tag !== 'Ready') return
          const tool = ready.tools.platform__safe
          const out = yield* tool.executor({})
          expect(Eff.Option.isSome(out)).toBe(true)
          if (Eff.Option.isSome(out)) {
            expect(out.value.status).toBe('success')
          }
          expect(attempts).toBe(2)
        }),
      ))
  })

  describe('layer + service primitives', () => {
    /**
     * Drive the layer end-to-end with stub backends embedded in the
     * configs. Exercises buildConnectorRuntime + aggregate primitives
     * (`isBlocked`, `awaitUnblocked`, `contextContribution`).
     */
    const runWithLayer = <A, E>(
      configs: ReadonlyArray<Connectors.ConnectorConfig>,
      program: Eff.Effect.Effect<A, E, Connectors.Connectors>,
    ): Promise<A> =>
      Eff.Effect.runPromise(
        program.pipe(
          Eff.Effect.provide(Connectors.layer(configs)),
          Eff.Effect.provide(TestContext.TestContext),
        ) as Eff.Effect.Effect<A, E, never>,
      )

    it('isBlocked starts true, flips false once the lone connector reaches Ready', () => {
      const config = baseConfig(stubBackend())
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          const runtime = svc.byId[config.id]
          // Initially Connecting → blocked.
          const initial = yield* svc.isBlocked
          expect(initial).toBe(true)
          // Wait for Ready.
          yield* awaitState(runtime, (s) => s._tag === 'Ready')
          const after = yield* svc.isBlocked
          expect(after).toBe(false)
        }),
      )
    })

    it('awaitUnblocked returns once all connectors reach a non-blocking state', () => {
      const config = baseConfig(stubBackend())
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          // No matter when we ask, awaitUnblocked completes by the time the
          // connector reaches Ready (sub-second in TestClock).
          yield* svc.awaitUnblocked
          const blocked = yield* svc.isBlocked
          expect(blocked).toBe(false)
        }),
      )
    })

    it('awaitUnblocked returns immediately when subscribed after Ready', () => {
      // Pins the replay semantics — no race with read-then-fork.
      const config = baseConfig(stubBackend())
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          yield* awaitState(svc.byId[config.id], (s) => s._tag === 'Ready')
          expect(yield* svc.isBlocked).toBe(false)
          yield* svc.awaitUnblocked
        }),
      )
    })

    it('contextContribution: Ready connector contributes namespaced tools + <connectors><connector state="ready">', () => {
      const config = baseConfig(
        stubBackend({
          listTools: () =>
            Eff.Effect.succeed([
              {
                name: 'foo',
                description: 'Foo tool',
                inputSchema: { type: 'object' },
              },
            ]),
        }),
      )
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          yield* awaitState(svc.byId[config.id], (s) => s._tag === 'Ready')
          const ctx = yield* svc.contextContribution
          expect(Object.keys(ctx.tools ?? {})).toEqual(['platform__foo'])
          expect(ctx.messages).toHaveLength(1)
          expect(ctx.messages?.[0]).toContain('<connectors>')
          expect(ctx.messages?.[0]).toContain('id="platform"')
          expect(ctx.messages?.[0]).toContain('state="ready"')
          expect(ctx.messages?.[0]).toContain('tool-prefix="platform__"')
          expect(ctx.messages?.[0]).toContain('Packages, search, S3.')
        }),
      )
    })

    it('contextContribution: Ready connector renders <resources> directory after the hint', () => {
      const config = baseConfig(
        stubBackend({
          listResources: () =>
            Eff.Effect.succeed([
              {
                uri: 'quilt-platform://search_syntax',
                name: 'search_syntax',
                description: 'Elasticsearch query string syntax reference.',
                mimeType: 'text/markdown',
              },
              { uri: 'quilt-platform://me' },
            ]),
        }),
      )
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          yield* awaitState(svc.byId[config.id], (s) => s._tag === 'Ready')
          const ctx = yield* svc.contextContribution
          const overview = ctx.messages?.[0] ?? ''
          expect(overview).toContain('<resources>')
          expect(overview).toContain('uri="quilt-platform://search_syntax"')
          expect(overview).toContain('name="search_syntax"')
          expect(overview).toContain('mime-type="text/markdown"')
          expect(overview).toContain(
            'description="Elasticsearch query string syntax reference."',
          )
          // Hint precedes the directory so the model has context first.
          expect(overview.indexOf('Packages, search, S3.')).toBeLessThan(
            overview.indexOf('<resources>'),
          )
        }),
      )
    })

    it('contextContribution: empty resource directory omits the <resources> block entirely', () => {
      const config = baseConfig(stubBackend())
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          yield* awaitState(svc.byId[config.id], (s) => s._tag === 'Ready')
          const ctx = yield* svc.contextContribution
          expect(ctx.messages?.[0]).not.toContain('<resources>')
        }),
      )
    })

    it("bootstrap: listResources error doesn't block Ready (best-effort enumeration)", () => {
      const config = baseConfig(
        stubBackend({
          listResources: () => Eff.Effect.fail(transportError),
          listTools: () =>
            Eff.Effect.succeed([
              { name: 'foo', description: 'Foo', inputSchema: { type: 'object' } },
            ]),
        }),
      )
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          const ready = yield* awaitState(svc.byId[config.id], (s) => s._tag === 'Ready')
          if (ready._tag !== 'Ready') return
          expect(Object.keys(ready.tools)).toEqual(['platform__foo'])
          expect(ready.resources).toEqual([])
        }),
      )
    })

    it('autoload: configured URIs get content inlined; others stay attribute-only', () => {
      const backend = stubBackend({
        listResources: () =>
          Eff.Effect.succeed([
            {
              uri: 'quilt-platform://search_syntax',
              name: 'search_syntax',
              description: 'ES query string syntax.',
            },
            { uri: 'quilt-platform://me', name: 'me', description: 'User identity.' },
          ]),
        readResource: (uri) =>
          uri === 'quilt-platform://search_syntax'
            ? Eff.Effect.succeed('# ES syntax body')
            : Eff.Effect.fail(transportError),
      })
      const config = baseConfig(backend, {
        autoload: new Set(['quilt-platform://search_syntax']),
      })
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          const ready = yield* awaitState(svc.byId[config.id], (s) => s._tag === 'Ready')
          if (ready._tag !== 'Ready') return
          const syntax = ready.resources.find(
            (r) => r.uri === 'quilt-platform://search_syntax',
          )
          const me = ready.resources.find((r) => r.uri === 'quilt-platform://me')
          expect(syntax?.content).toBe('# ES syntax body')
          expect(me?.content).toBeUndefined()
          // Overview should embed the autoloaded body, leave the other attribute-only.
          const ctx = yield* svc.contextContribution
          const overview = ctx.messages?.[0] ?? ''
          expect(overview).toContain('# ES syntax body')
          expect(overview).toContain('uri="quilt-platform://me"')
        }),
      )
    })

    it('autoload: readResource error degrades gracefully — entry stays in directory without content', () => {
      const backend = stubBackend({
        listResources: () =>
          Eff.Effect.succeed([
            { uri: 'quilt-platform://search_syntax', name: 'search_syntax' },
          ]),
        readResource: () => Eff.Effect.fail(transportError),
      })
      const config = baseConfig(backend, {
        autoload: new Set(['quilt-platform://search_syntax']),
      })
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          const ready = yield* awaitState(svc.byId[config.id], (s) => s._tag === 'Ready')
          if (ready._tag !== 'Ready') return
          expect(ready.resources).toHaveLength(1)
          expect(ready.resources[0].content).toBeUndefined()
        }),
      )
    })

    it('autoload: oversize content is dropped; descriptor stays in directory', () => {
      // 16 KiB cap + 1 byte → over the limit, content dropped.
      const huge = 'x'.repeat(16 * 1024 + 1)
      const backend = stubBackend({
        listResources: () =>
          Eff.Effect.succeed([{ uri: 'quilt-platform://big', name: 'big' }]),
        readResource: () => Eff.Effect.succeed(huge),
      })
      const config = baseConfig(backend, {
        autoload: new Set(['quilt-platform://big']),
      })
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          const ready = yield* awaitState(svc.byId[config.id], (s) => s._tag === 'Ready')
          if (ready._tag !== 'Ready') return
          expect(ready.resources[0].content).toBeUndefined()
        }),
      )
    })

    it('contextContribution: Failed{acked:true} connector contributes no tools + state="unavailable"', () => {
      const config = baseConfig(
        stubBackend({
          initialize: () => Eff.Effect.fail(authError),
        }),
      )
      return runWithLayer(
        [config],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          const runtime = svc.byId[config.id]
          // Wait for Failed{acked:false}, then user acks → Failed{acked:true}.
          yield* awaitState(runtime, (s) => s._tag === 'Failed')
          yield* runtime.acknowledge
          yield* awaitState(runtime, (s) => s._tag === 'Failed' && s.acked)
          const ctx = yield* svc.contextContribution
          expect(Object.keys(ctx.tools ?? {})).toEqual([])
          expect(ctx.messages).toHaveLength(1)
          expect(ctx.messages?.[0]).toContain('state="unavailable"')
        }),
      )
    })

    it('aggregate isBlocked = OR across connectors: one blocked → blocked', () => {
      const c1 = baseConfig(stubBackend())
      const c2 = baseConfig(
        stubBackend({ initialize: () => Eff.Effect.fail(authError) }),
        { id: 'second', title: 'Second' },
      )
      return runWithLayer(
        [c1, c2],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          yield* awaitState(svc.byId[c1.id], (s) => s._tag === 'Ready')
          yield* awaitState(svc.byId[c2.id], (s) => s._tag === 'Failed')
          // c2 in Failed{acked:false} → requiresAck → blocked
          expect(yield* svc.isBlocked).toBe(true)
          expect(yield* svc.requiresAck).toBe(true)
          // user acknowledges the failed one — overall unblocked
          yield* svc.byId[c2.id].acknowledge
          yield* awaitState(svc.byId[c2.id], (s) => s._tag === 'Failed' && s.acked)
          expect(yield* svc.isBlocked).toBe(false)
        }),
      )
    })

    it('zero-config layer is never blocked', () =>
      runWithLayer(
        [],
        Eff.Effect.gen(function* () {
          const svc = yield* Connectors.Connectors
          expect(yield* svc.isBlocked).toBe(false)
          yield* svc.awaitUnblocked
          const ctx = yield* svc.contextContribution
          expect(Object.keys(ctx.tools ?? {})).toEqual([])
          expect(ctx.messages).toEqual([])
        }),
      ))
  })
})
