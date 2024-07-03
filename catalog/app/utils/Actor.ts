import * as Eff from 'effect'
import * as React from 'react'

import useConstant from 'utils/useConstant'

type Tagged<TT extends string> = { readonly _tag: TT }
type Tag<T extends Tagged<any>> = T extends Tagged<infer TT> ? TT : never
type Variant<T extends Tagged<any>, TT extends string> = Extract<T, Tagged<TT>>

// transition to the next state,
// optionally fork a fiber to run background work, which may dispatch actions as well
type TransitionHandler<
  State extends Tagged<any>,
  Action extends Tagged<any>,
  StateTag extends Tag<State>,
  ActionTag extends Tag<Action>,
  R,
> = (
  state: Variant<State, StateTag>,
  action: Variant<Action, ActionTag>,
  dispatch: (action: Action) => Eff.Effect.Effect<boolean>,
) => Eff.Effect.Effect<State, never, R>

type TransitionsFromState<
  State extends Tagged<any>,
  Action extends Tagged<any>,
  StateTag extends Tag<State>,
  R,
> = {
  [ActionTag in Tag<Action>]: TransitionHandler<State, Action, StateTag, ActionTag, R>
}

type TransitionConfig<State extends Tagged<any>, Action extends Tagged<any>, R> = {
  [StateTag in Tag<State>]: TransitionsFromState<State, Action, StateTag, R>
}

interface ActorDefinition<State extends Tagged<any>, Action extends Tagged<any>, R> {
  transitions: TransitionConfig<State, Action, R>
}

// type Action
// type State
export function setup<State extends Tagged<any>, Action extends Tagged<any>, R>(
  transitions: TransitionConfig<State, Action, R>,
): ActorDefinition<State, Action, R> {
  return {
    transitions,
  }
}

interface ActorStopReason<State extends Tagged<any>> {
  state: State
}

interface Actor<State extends Tagged<any>, Action extends Tagged<any>> {
  state: Eff.SubscriptionRef.SubscriptionRef<State>
  actions: Eff.Queue.Queue<Action>
  fiber: Eff.Fiber.RuntimeFiber<ActorStopReason<State>>
  dispatch: (action: Action) => Eff.Effect.Effect<boolean>
}

export function start<State extends Tagged<any>, Action extends Tagged<any>, R>(
  definition: ActorDefinition<State, Action, R>,
  state: State,
): Eff.Effect.Effect<Actor<State, Action>, never, R> {
  return Eff.Effect.gen(function* () {
    yield* Eff.Console.log('starting actor', { definition, state })

    const stateRef = yield* Eff.SubscriptionRef.make(state)
    const actions = yield* Eff.Queue.unbounded<Action>()

    const dispatch = (action: Action) => Eff.Queue.offer(actions, action)

    const fiber = yield* Eff.Effect.forkDaemon(
      Eff.Effect.gen(function* () {
        // all state transitions are executed in this fiber
        yield* Eff.Console.log('started listener fiber')
        while (true) {
          const action = yield* Eff.Queue.take(actions)
          yield* Eff.Console.log('got action', action)
          const stateSnapshot = yield* Eff.SubscriptionRef.get(stateRef)
          yield* Eff.Console.log('state', stateSnapshot)
          const stateTag: Tag<State> = stateSnapshot._tag
          const actionTag: Tag<Action> = action._tag
          const transition = definition.transitions[stateTag][actionTag]
          const newState = yield* transition(
            stateSnapshot as Variant<State, Tag<State>>,
            action as Variant<Action, Tag<Action>>,
            dispatch,
          )
          yield* Eff.Console.log('transitioned to', newState)
          yield* Eff.SubscriptionRef.set(stateRef, newState)
          yield* Eff.Console.log('state updated')
        }
      }),
    )
    return {
      state: stateRef,
      actions,
      fiber,
      dispatch,
    }
  })
}

export const ignore = Eff.Effect.succeed

export function useState<State extends Tagged<any>>(
  stateRef: Eff.SubscriptionRef.SubscriptionRef<State>,
): State {
  const [state, setState] = React.useState<State>(() =>
    Eff.Effect.runSync(Eff.SubscriptionRef.get(stateRef)),
  )
  React.useEffect(() => {
    // subscribe to state changes
    const listener = Eff.Effect.runFork(
      Eff.Effect.gen(function* () {
        yield* Eff.Console.log('useState: subscribing to state changes', stateRef)
        yield* Eff.Stream.runForEach(stateRef.changes, (s) =>
          Eff.Effect.gen(function* () {
            yield* Eff.Console.log('useState: state change', s)
            yield* Eff.Effect.sync(() => setState(s))
            yield* Eff.Console.log('useState: state updated')
          }),
        )
        yield* Eff.Console.log('useState: subscription ended')
      }),
    )
    // unsubcribe from state changes
    return () => {
      Eff.Effect.gen(function* () {
        yield* Eff.Console.log('useState: unsubscribing from state changes', listener)
        const exit = yield* Eff.Fiber.interrupt(listener)
        yield* Eff.Console.log('useState: listener fiber interrupted', exit)
      }).pipe(Eff.Effect.runFork)
    }
  }, [stateRef])

  return state
}

export function useActor<State extends Tagged<any>, Action extends Tagged<any>>(
  defEff: Eff.Effect.Effect<ActorDefinition<State, Action, never>>,
  initEff: Eff.Effect.Effect<State>,
) {
  const actor = useConstant(() =>
    Eff.Effect.gen(function* () {
      yield* Eff.Console.log('useActor: initializing actor')
      const def = yield* defEff
      yield* Eff.Console.log('useActor: got definition', def)
      const init = yield* initEff
      yield* Eff.Console.log('useActor: got initial state', init)
      const a = yield* start(def, init)
      yield* Eff.Console.log('useActor: started actor', a)
      return a
      // TODO: how/where to provide dependencies?
    }).pipe(Eff.Effect.runSync),
  )

  // TODO: stop/interrupt on unmount

  // TODO: make state lazy/subscriptable a-la redux
  const state = useState(actor.state)

  // XXX: provide dependencies to dispatch?
  const dispatch = React.useCallback(
    (action: Action) => Eff.Effect.runSync(actor.dispatch(action)),
    [actor],
  )
  return [state, dispatch] as const
}
