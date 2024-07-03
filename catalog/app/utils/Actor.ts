import * as Eff from 'effect'
import * as React from 'react'

import useConstant from 'utils/useConstant'

export type Dispatch<Action> = (action: Action) => Eff.Effect.Effect<boolean>

// transition to the next state,
// optionally fork a fiber to run background work, which may dispatch actions as well
export type ActorDefinition<State, Action, R> = (
  state: State,
  action: Action,
  dispatch: Dispatch<Action>,
) => Eff.Effect.Effect<State, never, R>

interface ActorStopReason<State> {
  state: State
}

interface Actor<State, Action> {
  state: Eff.SubscriptionRef.SubscriptionRef<State>
  actions: Eff.Queue.Queue<Action>
  fiber: Eff.Fiber.RuntimeFiber<ActorStopReason<State>>
  dispatch: Dispatch<Action>
}

export const fromCurried =
  <State, Action, R>(
    curried: (
      dispatch: Dispatch<Action>,
    ) => (state: State) => (action: Action) => Eff.Effect.Effect<State, never, R>,
  ): ActorDefinition<State, Action, R> =>
  (state, action, dispatch) =>
    curried(dispatch)(state)(action)

type ActionHandlers<
  State extends Tagged<string>,
  Action extends Tagged<string>,
  StateTag extends State['_tag'],
> = {
  [ActionTag in Action['_tag']]?: (
    state: Extract<State, { _tag: StateTag }>,
    action: Extract<Action, { _tag: ActionTag }>,
    dispatch: Dispatch<Action>,
  ) => Eff.Effect.Effect<State>
}

interface Tagged<T> {
  _tag: T
}

type StateHandlers<State extends Tagged<string>, Action extends Tagged<string>> = {
  [StateTag in State['_tag']]?: ActionHandlers<State, Action, StateTag>
}

export function taggedHandler<
  State extends Tagged<string>,
  Action extends Tagged<string>,
>(transitions: StateHandlers<State, Action>): ActorDefinition<State, Action, never> {
  return <ST extends State['_tag'], AT extends Action['_tag']>(
    state: State,
    action: Action,
    dispatch: Dispatch<Action>,
  ): Eff.Effect.Effect<State> => {
    const transition = transitions[state._tag as ST]?.[action._tag as AT]
    if (transition) {
      return transition(
        state as Extract<State, { _tag: ST }>,
        action as Extract<Action, { _tag: AT }>,
        dispatch,
      )
    }
    return Eff.Effect.succeed(state)
  }
}

export function start<State, Action, R>(
  definition: ActorDefinition<State, Action, R>,
  state: State,
): Eff.Effect.Effect<Actor<State, Action>, never, R> {
  return Eff.Effect.gen(function* () {
    yield* Eff.Console.log('Actor/start: starting actor', { definition, state })

    const stateRef = yield* Eff.SubscriptionRef.make(state)
    const actions = yield* Eff.Queue.unbounded<Action>()

    const dispatch = (action: Action) => Eff.Queue.offer(actions, action)

    const fiber = yield* Eff.Effect.forkDaemon(
      Eff.Effect.gen(function* () {
        // all state transitions are executed in this fiber
        yield* Eff.Console.log('Actor/start/listener: listening')
        while (true) {
          const action = yield* Eff.Queue.take(actions)
          yield* Eff.Console.log('Actor/start/listener: got action', action)
          yield* Eff.SubscriptionRef.updateEffect(stateRef, (s) =>
            definition(s, action, dispatch),
          )
          yield* Eff.Console.log('Actor/start/listener: state updated')
        }
      }),
    )
    yield* Eff.Console.log('Actor/start: started listener fiber', fiber)
    return {
      state: stateRef,
      actions,
      fiber,
      dispatch,
    }
  })
}

export const ignore = Eff.Effect.succeed

export function useState<State>(
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

export function useActor<State, Action>(
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
