/**
 * Conversation actor tests — state-machine transitions around
 * AwaitingConnector + the ConnectorReady action (D25).
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
 * LLM stub — `converse` returns the provided response. The deferred
 * lets tests notice when the LLM was actually invoked. The only stable
 * shape we need from the response is `content: Option.Option<[]>` and
 * the BedrockRuntime envelope — we minimally satisfy both with `[]`.
 */
const makeLLMStub = (next: Eff.Deferred.Deferred<unknown>): LLM.LLM['Type'] => ({
  converse: () =>
    Eff.Effect.gen(function* () {
      yield* Eff.Deferred.succeed(next, undefined)
      return {
        // Force at least one content block so the actor doesn't error;
        // empty content array is the simplest valid shape.
        content: Eff.Option.some([]),
        backendResponse: {} as never,
      }
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

          const connectorTool: Tool.Descriptor<Record<string, unknown>> = {
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
              Eff.Effect.succeed({
                content: Eff.Option.some([
                  Content.ResponseMessageContentBlock.ToolUse({
                    toolUseId: 'tu1',
                    name: 'c1__t1',
                    input: {},
                  }),
                ]),
                backendResponse: {} as never,
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
