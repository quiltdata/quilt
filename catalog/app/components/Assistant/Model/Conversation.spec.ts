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
import * as Context from './Context'
import * as Conversation from './Conversation'
import * as LLM from './LLM'

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
})
