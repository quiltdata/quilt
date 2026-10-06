/**
 * Conversation actor tests — state-machine transitions around
 * AwaitingConnector + the ConnectorReady action.
 *
 * The actor runs as a daemon fiber inside Actor.start; we dispatch
 * actions, await state-changes via SubscriptionRef.changes, and assert
 * the resulting state.
 */

import * as Eff from 'effect'
import * as TestClock from 'effect/TestClock'
import * as TestContext from 'effect/TestContext'
import { describe, expect, it, vi } from 'vitest'

import * as Actor from 'utils/Actor'

import * as Connectors from './Connectors'
import * as Content from './Content'
import * as Context from './Context'
import * as Conversation from './Conversation'
import * as LLM from './LLM'
import * as Tool from './Tool'

vi.mock('constants/config', () => ({ default: {} }))

/**
 * Build a Connectors service stub. `isBlockedRef` is a SubscriptionRef so
 * tests can flip it mid-run; `awaitUnblocked` then resolves only when it
 * flips false. `byId` is empty (no per-connector runtimes; tests don't
 * exercise tool dispatch — that's covered in Connectors.spec.ts).
 */
const makeConnectorsStub = (
  isBlockedRef: Eff.SubscriptionRef.SubscriptionRef<boolean>,
): Connectors.ConnectorsService => ({
  byId: {},
  isTransient: Eff.SubscriptionRef.get(isBlockedRef),
  requiresAck: Eff.Effect.succeed(false),
  isBlocked: Eff.SubscriptionRef.get(isBlockedRef),
  awaitUnblocked: Eff.pipe(
    isBlockedRef.changes,
    Eff.Stream.filter((b) => !b),
    Eff.Stream.take(1),
    Eff.Stream.runDrain,
  ),
  contextContribution: Eff.Effect.succeed({ tools: {}, messages: [] }),
})

const makeContextStub = (): {
  context: Eff.Effect.Effect<Context.ContextShape>
} => ({
  context: Eff.Effect.succeed({ tools: {}, messages: [], markers: {} }),
})

/**
 * LLM stub — `converse` signals via the deferred that it was invoked, then
 * suspends. A real `converse` is an async round-trip, so the conversation
 * stays in `WaitingForAssistant` (an observable state) for the duration. If
 * the stub returned synchronously instead, the actor would fall straight back
 * to Idle and effect's scheduler would coalesce the transient
 * `WaitingForAssistant` out of `state.changes` before any observer saw it.
 * Tests that need the response delivered gate their own stub (see below).
 */
const makeLLMStub = (called: Eff.Deferred.Deferred<unknown>): LLM.LLM['Type'] => ({
  converse: () =>
    Eff.Effect.gen(function* () {
      yield* Eff.Deferred.succeed(called, undefined)
      yield* Eff.Effect.never
      return { content: Eff.Option.some([]), backendResponse: {} as never }
    }),
})

const runActor = <A>(
  build: (
    actor: Actor.Actor<Conversation.State, Conversation.Action>,
    isBlockedRef: Eff.SubscriptionRef.SubscriptionRef<boolean>,
    llmCalled: Eff.Deferred.Deferred<unknown>,
  ) => Eff.Effect.Effect<A, never, Eff.Scope.Scope>,
): Promise<A> =>
  Eff.Effect.runPromise(
    Eff.Effect.scoped(
      Eff.Effect.gen(function* () {
        const isBlockedRef = yield* Eff.SubscriptionRef.make(false)
        const llmCalled = yield* Eff.Deferred.make<unknown>()
        const connectorsStub = makeConnectorsStub(isBlockedRef)
        const layer = Eff.Layer.mergeAll(
          Eff.Layer.succeed(Connectors.Connectors, connectorsStub),
          Eff.Layer.succeed(LLM.LLM, makeLLMStub(llmCalled)),
          Eff.Layer.succeed(Context.ConversationContext, makeContextStub()),
        )
        const initial = yield* Conversation.init
        const definition = yield* Conversation.ConversationActor
        const actor = yield* Actor.start(definition, initial, Eff.Effect.succeed(layer))
        return yield* build(actor, isBlockedRef, llmCalled)
      }),
    ).pipe(Eff.Effect.provide(TestContext.TestContext)) as Eff.Effect.Effect<A>,
  )

const awaitState = (
  actor: Actor.Actor<Conversation.State, Conversation.Action>,
  predicate: (s: Conversation.State) => boolean,
): Eff.Effect.Effect<Conversation.State> =>
  Eff.pipe(
    actor.state.changes,
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

describe('Conversation actor — connector gating', () => {
  it('Idle + Ask + connectors unblocked → WaitingForAssistant', () =>
    runActor((actor) =>
      Eff.Effect.gen(function* () {
        yield* actor.dispatch(Conversation.Action.Ask({ content: 'hi' }))
        const next = yield* awaitState(actor, (s) => s._tag !== 'Idle')
        expect(next._tag).toBe('WaitingForAssistant')
        if (next._tag !== 'WaitingForAssistant') return
        // user message landed
        expect(next.events).toHaveLength(1)
        expect(next.events[0]._tag).toBe('Message')
      }),
    ))

  it('Idle + Ask + connectors blocked → AwaitingConnector', () =>
    runActor((actor, isBlocked) =>
      Eff.Effect.gen(function* () {
        yield* Eff.SubscriptionRef.set(isBlocked, true)
        yield* actor.dispatch(Conversation.Action.Ask({ content: 'hi' }))
        const next = yield* awaitState(actor, (s) => s._tag === 'AwaitingConnector')
        expect(next._tag).toBe('AwaitingConnector')
        if (next._tag !== 'AwaitingConnector') return
        expect(next.events).toHaveLength(1)
      }),
    ))

  it('AwaitingConnector + unblock → ConnectorReady fires → WaitingForAssistant', () =>
    runActor((actor, isBlocked, llmCalled) =>
      Eff.Effect.gen(function* () {
        yield* Eff.SubscriptionRef.set(isBlocked, true)
        yield* actor.dispatch(Conversation.Action.Ask({ content: 'hi' }))
        yield* awaitState(actor, (s) => s._tag === 'AwaitingConnector')
        // unblock — waiter dispatches ConnectorReady — actor transitions
        yield* Eff.SubscriptionRef.set(isBlocked, false)
        const next = yield* awaitState(actor, (s) => s._tag === 'WaitingForAssistant')
        expect(next._tag).toBe('WaitingForAssistant')
        // and the LLM was actually invoked
        yield* Eff.Deferred.await(llmCalled)
      }),
    ))

  it('AwaitingConnector + Abort → Idle (waiter interrupted)', () =>
    runActor((actor, isBlocked, llmCalled) =>
      Eff.Effect.gen(function* () {
        yield* Eff.SubscriptionRef.set(isBlocked, true)
        yield* actor.dispatch(Conversation.Action.Ask({ content: 'hi' }))
        yield* awaitState(actor, (s) => s._tag === 'AwaitingConnector')
        // user aborts
        yield* actor.dispatch(Conversation.Action.Abort())
        const next = yield* awaitState(actor, (s) => s._tag === 'Idle')
        expect(next._tag).toBe('Idle')
        if (next._tag !== 'Idle') return
        // events are preserved (the user message stays in the conversation)
        expect(next.events).toHaveLength(1)
        // unblocking after abort must NOT trigger LLM — waiter was interrupted
        yield* Eff.SubscriptionRef.set(isBlocked, false)
        // give the runtime a tick to process anything in flight
        yield* TestClock.adjust(Eff.Duration.millis(10))
        const llmFired = yield* Eff.Deferred.isDone(llmCalled)
        expect(llmFired).toBe(false)
      }),
    ))

  it('AwaitingConnector + Discard → still AwaitingConnector with event marked discarded', () =>
    runActor((actor, isBlocked) =>
      Eff.Effect.gen(function* () {
        yield* Eff.SubscriptionRef.set(isBlocked, true)
        yield* actor.dispatch(Conversation.Action.Ask({ content: 'hi' }))
        const awaiting = yield* awaitState(actor, (s) => s._tag === 'AwaitingConnector')
        if (awaiting._tag !== 'AwaitingConnector') return
        const id = awaiting.events[0].id
        yield* actor.dispatch(Conversation.Action.Discard({ id }))
        const next = yield* awaitState(
          actor,
          (s) => s._tag === 'AwaitingConnector' && s.events.some((e) => e.discarded),
        )
        expect(next._tag).toBe('AwaitingConnector')
        if (next._tag !== 'AwaitingConnector') return
        expect(next.events[0].discarded).toBe(true)
      }),
    ))

  it('AwaitingConnector re-enters fresh on each Ask while blocked (no waiter leak)', () =>
    runActor((actor, isBlocked) =>
      Eff.Effect.gen(function* () {
        yield* Eff.SubscriptionRef.set(isBlocked, true)
        // First Ask while blocked → AwaitingConnector with waiter₁
        yield* actor.dispatch(Conversation.Action.Ask({ content: 'one' }))
        const first = yield* awaitState(actor, (s) => s._tag === 'AwaitingConnector')
        if (first._tag !== 'AwaitingConnector') return
        const waiter1 = first.waiter
        // Abort to clear, then re-Ask — verifies the waiter handle is fresh
        // each entry rather than reusing a stale fiber from a prior cycle.
        yield* actor.dispatch(Conversation.Action.Abort())
        yield* awaitState(actor, (s) => s._tag === 'Idle')
        yield* actor.dispatch(Conversation.Action.Ask({ content: 'two' }))
        const second = yield* awaitState(
          actor,
          (s) => s._tag === 'AwaitingConnector' && s.events.length === 2,
        )
        if (second._tag !== 'AwaitingConnector') return
        expect(second.waiter).not.toBe(waiter1)
      }),
    ))

  /**
   * The other gate point in `advanceFromEvents` is `ToolUse.ToolResult`
   * (last call resolves). Set up: Idle + Ask while unblocked → LLM
   * returns ToolUse → ToolUse state → mid-tool-execution, flip blocked
   * → tool resolves → handler reads isBlocked synchronously → must
   * transition to AwaitingConnector, not WaitingForAssistant.
   */
  it('ToolUse + ToolResult (last) + connectors blocked → AwaitingConnector', () =>
    Eff.Effect.runPromise(
      Eff.Effect.scoped(
        Eff.Effect.gen(function* () {
          const isBlockedRef = yield* Eff.SubscriptionRef.make(false)
          // Gate the LLM converse so we can sequence: ToolUse arrives only
          // after we've staged the test, and the tool fiber doesn't race
          // ahead before we flip isBlocked.
          const llmGate = yield* Eff.Deferred.make<void>()
          const llmResponded = yield* Eff.Deferred.make<void>()
          const llm: LLM.LLM['Type'] = {
            converse: () =>
              Eff.Effect.gen(function* () {
                yield* Eff.Deferred.await(llmGate)
                yield* Eff.Deferred.succeed(llmResponded, undefined)
                return {
                  content: Eff.Option.some([
                    Content.ResponseMessageContentBlock.ToolUse({
                      toolUseId: 'tu1',
                      name: 'missing-tool',
                      input: {},
                    }),
                  ]),
                  backendResponse: {} as never,
                }
              }),
          }
          const layer = Eff.Layer.mergeAll(
            Eff.Layer.succeed(Connectors.Connectors, makeConnectorsStub(isBlockedRef)),
            Eff.Layer.succeed(LLM.LLM, llm),
            Eff.Layer.succeed(Context.ConversationContext, makeContextStub()),
          )
          const initial = yield* Conversation.init
          const definition = yield* Conversation.ConversationActor
          const actor = yield* Actor.start(definition, initial, Eff.Effect.succeed(layer))

          // Ask while unblocked → WaitingForAssistant; LLM is still gated.
          yield* actor.dispatch(Conversation.Action.Ask({ content: 'do thing' }))
          yield* awaitState(actor, (s) => s._tag === 'WaitingForAssistant')

          // Block connectors NOW so by the time the tool resolves and
          // ToolResult fires, the next gate evaluates true.
          yield* Eff.SubscriptionRef.set(isBlockedRef, true)

          // Release the LLM. ToolUse landed → tool fiber executes the
          // unknown tool ("Tool 'missing-tool' not found" → Tool.fail) →
          // ToolResult dispatched → advanceFromEvents reads isBlocked →
          // AwaitingConnector.
          yield* Eff.Deferred.succeed(llmGate, undefined)
          yield* Eff.Deferred.await(llmResponded)

          const next = yield* awaitState(actor, (s) => s._tag === 'AwaitingConnector')
          expect(next._tag).toBe('AwaitingConnector')
          if (next._tag !== 'AwaitingConnector') return
          // Two events: user message + tool-use record (with the fail result).
          expect(next.events).toHaveLength(2)
          expect(next.events[0]._tag).toBe('Message')
          expect(next.events[1]._tag).toBe('ToolUse')
        }),
      ).pipe(Eff.Effect.provide(TestContext.TestContext)) as Eff.Effect.Effect<void>,
    ))

  /**
   * Regression: connector-contributed tools must be reachable from the
   * `LLMResponse` execute path, not just from the LLM-request path.
   *
   * Before the fix, `llmRequest` merged React + connector tool collections
   * (so the LLM saw `c1__t1`), but the `LLMResponse` handler read tools
   * from the React context only. Every connector tool round-tripped as a
   * synthetic "Tool ... not found" without ever hitting the wire.
   */
  it('LLMResponse executes connector-contributed tools', () =>
    Eff.Effect.runPromise(
      Eff.Effect.scoped(
        Eff.Effect.gen(function* () {
          const isBlockedRef = yield* Eff.SubscriptionRef.make(false)
          const executorRan = yield* Eff.Deferred.make<void>()
          const responded = yield* Eff.Ref.make(false)

          const connectorTool: Tool.Descriptor<Record<string, unknown>> = {
            effect: 'read',
            schema: {} as Eff.JSONSchema.JsonSchema7Root,
            executor: () =>
              Eff.Effect.gen(function* () {
                yield* Eff.Deferred.succeed(executorRan, undefined)
                return Eff.Option.some(
                  Tool.succeed(
                    Content.ToolResultContentBlock.Text({ text: 'connector-ran' }),
                  ),
                )
              }),
          }
          const connectorsStub: Connectors.ConnectorsService = {
            ...makeConnectorsStub(isBlockedRef),
            contextContribution: Eff.Effect.succeed({
              tools: { c1__t1: connectorTool },
              messages: [],
            }),
          }
          const llm: LLM.LLM['Type'] = {
            converse: () =>
              Eff.Effect.gen(function* () {
                // Issue the tool-use once. On the follow-up round (after the
                // ToolResult) respond with no tools so the conversation
                // settles, instead of looping converse → ToolUse → converse
                // forever.
                if (yield* Eff.Ref.getAndSet(responded, true)) {
                  return { content: Eff.Option.some([]), backendResponse: {} as never }
                }
                return {
                  content: Eff.Option.some([
                    Content.ResponseMessageContentBlock.ToolUse({
                      toolUseId: 'tu1',
                      name: 'c1__t1',
                      input: {},
                    }),
                  ]),
                  backendResponse: {} as never,
                }
              }),
          }
          const layer = Eff.Layer.mergeAll(
            Eff.Layer.succeed(Connectors.Connectors, connectorsStub),
            Eff.Layer.succeed(LLM.LLM, llm),
            Eff.Layer.succeed(Context.ConversationContext, makeContextStub()),
          )
          const initial = yield* Conversation.init
          const definition = yield* Conversation.ConversationActor
          const actor = yield* Actor.start(definition, initial, Eff.Effect.succeed(layer))

          yield* actor.dispatch(
            Conversation.Action.Ask({ content: 'use connector tool' }),
          )
          // Without the fix, executor is never invoked — Tool.execute can't
          // find `c1__t1` in the React-only collection — and this await
          // hangs past the vitest timeout.
          yield* Eff.Deferred.await(executorRan)

          // The recorded ToolUse event should carry the executor's success
          // result, not the "Tool ... not found" fallback.
          const final = yield* awaitState(actor, (s) =>
            s.events.some((e) => e._tag === 'ToolUse' && e.toolUseId === 'tu1'),
          )
          const event = final.events.find((e) => e._tag === 'ToolUse')
          expect(event?._tag).toBe('ToolUse')
          if (event?._tag !== 'ToolUse') return
          expect(event.result.status).toBe('success')
        }),
      ).pipe(Eff.Effect.provide(TestContext.TestContext)) as Eff.Effect.Effect<void>,
    ))
})

describe('write approval', () => {
  /**
   * One LLM round asking for `toolUses`, then a settling round with none.
   * `runs` counts executions per tool name.
   */
  const setup = (toolUses: { id: string; name: string; effect: Tool.Effect }[]) =>
    Eff.Effect.gen(function* () {
      const isBlockedRef = yield* Eff.SubscriptionRef.make(false)
      const runs = yield* Eff.Ref.make<Record<string, number>>({})
      const responded = yield* Eff.Ref.make(false)
      const tools: Tool.Collection = Object.fromEntries(
        toolUses.map(({ name, effect }) => [
          name,
          {
            effect,
            schema: {} as Eff.JSONSchema.JsonSchema7Root,
            executor: () =>
              Eff.Ref.update(runs, (r) => ({ ...r, [name]: (r[name] ?? 0) + 1 })).pipe(
                Eff.Effect.as(
                  Eff.Option.some(
                    Tool.succeed(Content.ToolResultContentBlock.Text({ text: 'ran' })),
                  ),
                ),
              ),
          },
        ]),
      )
      const llm: LLM.LLM['Type'] = {
        converse: () =>
          Eff.Effect.gen(function* () {
            if (yield* Eff.Ref.getAndSet(responded, true)) {
              return { content: Eff.Option.some([]), backendResponse: {} as never }
            }
            return {
              content: Eff.Option.some(
                toolUses.map(({ id, name }) =>
                  Content.ResponseMessageContentBlock.ToolUse({
                    toolUseId: id,
                    name,
                    input: { bucket: 'b' },
                  }),
                ),
              ),
              backendResponse: {} as never,
            }
          }),
      }
      const layer = Eff.Layer.mergeAll(
        Eff.Layer.succeed(Connectors.Connectors, {
          ...makeConnectorsStub(isBlockedRef),
          contextContribution: Eff.Effect.succeed({ tools, messages: [] }),
        }),
        Eff.Layer.succeed(LLM.LLM, llm),
        Eff.Layer.succeed(Context.ConversationContext, makeContextStub()),
      )
      const definition = yield* Conversation.ConversationActor
      const actor = yield* Actor.start(
        definition,
        yield* Conversation.init,
        Eff.Effect.succeed(layer),
      )
      yield* actor.dispatch(Conversation.Action.Ask({ content: 'go' }))
      const pending = yield* awaitState(
        actor,
        (s) => s._tag === 'ToolUse' && Object.values(s.calls).some((c) => c.approval),
      )
      return { actor, runs, pending }
    })

  const run = (test: Eff.Effect.Effect<void, never, Eff.Scope.Scope>) =>
    Eff.Effect.runPromise(
      Eff.Effect.scoped(test).pipe(
        Eff.Effect.provide(TestContext.TestContext),
      ) as Eff.Effect.Effect<void>,
    )

  const settled = (s: Conversation.State) => s._tag === 'Idle'

  it('holds a write until approved, then runs it once', () =>
    run(
      Eff.Effect.gen(function* () {
        const { actor, runs, pending } = yield* setup([
          { id: 'w', name: 'put', effect: 'write' },
        ])
        expect(pending._tag === 'ToolUse' && pending.calls.w.approval).toBe('write')
        expect(yield* Eff.Ref.get(runs)).toEqual({})

        yield* actor.dispatch(Conversation.Action.Approve({ id: 'w' }))
        yield* actor.dispatch(Conversation.Action.Approve({ id: 'w' }))
        yield* awaitState(actor, settled)
        expect(yield* Eff.Ref.get(runs)).toEqual({ put: 1 })
      }),
    ))

  it('a denied write never runs and the model is told why', () =>
    run(
      Eff.Effect.gen(function* () {
        const { actor, runs } = yield* setup([
          { id: 'w', name: 'create', effect: 'destructive' },
        ])
        yield* actor.dispatch(Conversation.Action.Deny({ id: 'w' }))
        yield* actor.dispatch(Conversation.Action.Approve({ id: 'w' }))
        const final = yield* awaitState(actor, settled)
        expect(yield* Eff.Ref.get(runs)).toEqual({})
        const event = final.events.find((e) => e._tag === 'ToolUse')
        if (event?._tag !== 'ToolUse') throw new Error('no ToolUse event')
        expect(event.result.status).toBe('error')
        expect(JSON.stringify(event.result.content)).toContain('Declined by the user')
      }),
    ))

  it('a tool name inherited from Object.prototype is not a tool', () =>
    run(
      Eff.Effect.gen(function* () {
        const result = yield* Tool.execute({}, 'toString', {})
        expect(Eff.Option.getOrThrow(result).status).toBe('error')
      }),
    ))

  it('Abort drops a pending write without running it', () =>
    run(
      Eff.Effect.gen(function* () {
        const { actor, runs } = yield* setup([{ id: 'w', name: 'put', effect: 'write' }])
        yield* actor.dispatch(Conversation.Action.Abort())
        const final = yield* awaitState(actor, settled)
        expect(yield* Eff.Ref.get(runs)).toEqual({})
        expect(final.events.some((e) => e._tag === 'ToolUse')).toBe(false)
      }),
    ))

  it('reads in the same batch run without waiting', () =>
    run(
      Eff.Effect.gen(function* () {
        const { actor, runs } = yield* setup([
          { id: 'r', name: 'list', effect: 'read' },
          { id: 'w', name: 'put', effect: 'write' },
        ])
        yield* awaitState(
          actor,
          (s) => s._tag === 'ToolUse' && !('r' in s.calls) && 'w' in s.calls,
        )
        expect(yield* Eff.Ref.get(runs)).toEqual({ list: 1 })
        yield* actor.dispatch(Conversation.Action.Deny({ id: 'w' }))
        yield* awaitState(actor, settled)
      }),
    ))
})
