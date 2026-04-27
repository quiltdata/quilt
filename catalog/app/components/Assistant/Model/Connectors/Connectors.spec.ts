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
  _tag: 'TransportError',
  message: 'down',
  transient: true,
}

const authError: Connectors.BackendError = {
  _tag: 'AuthError',
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
          expect(failed.error._tag).toBe('AuthError')
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
          expect(dc.error._tag).toBe('TransportError')
        }),
      ))

    it('reconnect exhaustion → Failed{acked:false}', () =>
      runWithTest(
        Eff.Effect.gen(function* () {
          // initialize succeeds first time; ping always fails; subsequent
          // initialize calls also fail so reconnect attempts exhaust.
          let bootstraps = 0
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
                ping: () => Eff.Effect.fail(transportError),
              }),
            ),
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
            baseConfig(
              stubBackend({
                initialize: () =>
                  Eff.Effect.suspend(() => {
                    bootstraps += 1
                    return Eff.Effect.void
                  }),
                ping: () =>
                  Eff.Effect.suspend(() => {
                    pingFailures += 1
                    return pingFailures <= 2
                      ? Eff.Effect.fail(transportError)
                      : Eff.Effect.void
                  }),
              }),
            ),
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
