import * as Eff from 'effect'
import * as React from 'react'

import { runtime } from 'utils/Effect'
import * as Log from 'utils/Logging'
import useConstant from 'utils/useConstant'

const MODULE = 'Actor'

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
  listener: Eff.Fiber.RuntimeFiber<ActorStopReason<State>>
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
  R,
> = {
  [ActionTag in Action['_tag']]?: (
    state: Extract<State, { _tag: StateTag }>,
    action: Extract<Action, { _tag: ActionTag }>,
    dispatch: Dispatch<Action>,
  ) => Eff.Effect.Effect<State, never, R>
}

interface Tagged<T> {
  _tag: T
}

type StateHandlers<State extends Tagged<string>, Action extends Tagged<string>, R> = {
  [StateTag in State['_tag']]?: ActionHandlers<State, Action, StateTag, R>
}

export function taggedHandler<
  State extends Tagged<string>,
  Action extends Tagged<string>,
  R,
>(transitions: StateHandlers<State, Action, R>): ActorDefinition<State, Action, R> {
  return <ST extends State['_tag'], AT extends Action['_tag']>(
    state: State,
    action: Action,
    dispatch: Dispatch<Action>,
  ): Eff.Effect.Effect<State, never, R> => {
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
  layerEff: Eff.Effect.Effect<Eff.Layer.Layer<R>>,
): Eff.Effect.Effect<Actor<State, Action>> {
  return Log.scoped({
    name: `${MODULE}.start`,
    enter: [Log.br, 'definition:', definition, Log.br, 'state:', state],
  })(
    Eff.Effect.gen(function* () {
      const stateRef = yield* Eff.SubscriptionRef.make(state)
      const actions = yield* Eff.Queue.unbounded<Action>()

      const dispatch = (action: Action) =>
        Log.scoped({
          name: 'dispatch',
          enter: [Log.br, 'action:', action],
        })(Eff.Queue.offer(actions, action))

      const listener = yield* Eff.Effect.forkDaemon(
        Log.scoped('listener')(
          Eff.Effect.gen(function* () {
            // all state transitions are executed in this fiber
            while (true) {
              const action = yield* Eff.Queue.take(actions)
              // TODO: log events to the inspector
              yield* Eff.Effect.log('got action', Log.br, 'action:', action)

              const layer = yield* layerEff
              yield* Eff.SubscriptionRef.updateEffect(stateRef, (s) =>
                definition(s, action, dispatch).pipe(Eff.Effect.provide(layer)),
              )
              yield* Eff.Effect.log('state updated')
            }
          }),
        ),
      )

      // TODO: send snapshots to the inspector
      yield* Eff.Effect.log('started listener fiber', Log.br, listener)

      // TODO: register the actor with the inspector

      return {
        state: stateRef,
        actions,
        listener,
        dispatch,
      }
    }),
  )
}

export function useState<State>(
  stateRef: Eff.SubscriptionRef.SubscriptionRef<State>,
): State {
  const [state, setState] = React.useState<State>(() =>
    runtime.runSync(
      Log.scoped({
        name: `${MODULE}.useState:init`,
        enter: [Log.br, 'getting inital state from subscription ref:', stateRef],
      })(Eff.SubscriptionRef.get(stateRef)),
    ),
  )
  React.useEffect(() => {
    // subscribe to state changes
    const listener = runtime.runFork(
      Log.scoped({
        name: `${MODULE}.useState:listener`,

        enter: [Log.br, 'subscribing to state changes:', stateRef],
      })(
        Eff.Stream.runForEach(stateRef.changes, (s) =>
          Eff.Effect.gen(function* () {
            yield* Eff.Effect.log('actor state changed', Log.br, 'new state:', s)
            yield* Eff.Effect.sync(() => setState(s))
            yield* Eff.Effect.log('react state updated')
          }),
        ),
      ),
    )
    // unsubcribe from state changes
    return () => {
      runtime.runFork(
        Log.scoped({
          name: `${MODULE}.useState:cleanup`,
          enter: [
            Log.br,
            'unsubscribing from state changes, interrupting listener:',
            listener,
          ],
        })(Eff.Fiber.interrupt(listener)),
      )
    }
  }, [stateRef])

  return state
}

export function useActor<State, Action>(
  defEff: Eff.Effect.Effect<ActorDefinition<State, Action, never>>,
  initEff: Eff.Effect.Effect<State>,
) {
  return useActorLayer(defEff, initEff, Eff.Effect.succeed(Eff.Layer.empty))
}

export function useActorLayer<State, Action, R>(
  defEff: Eff.Effect.Effect<ActorDefinition<State, Action, R>>,
  initEff: Eff.Effect.Effect<State>,
  layerEff: Eff.Effect.Effect<Eff.Layer.Layer<R>>,
) {
  const actor = useConstant(() =>
    Eff.Effect.gen(function* () {
      const def = yield* defEff
      yield* Eff.Effect.log('got definition', Log.br, def)
      const init = yield* initEff
      yield* Eff.Effect.log('got initial state', Log.br, init)
      // XXX: how/where to provide dependencies?
      const a = yield* start(def, init, layerEff)
      yield* Eff.Effect.log('started actor', Log.br, a)
      return a
    }).pipe(
      Log.scoped({
        name: `${MODULE}.useActor`,
        enter: [
          Log.br,
          'definition effect:',
          defEff,
          Log.br,
          'initial state effect:',
          initEff,
        ],
      }),
      runtime.runSync,
    ),
  )

  // TODO: stop/interrupt on unmount

  // TODO: make state lazy/subscriptable a-la redux
  const state = useState(actor.state)

  // XXX: provide dependencies to dispatch?
  const dispatch = React.useCallback(
    (action: Action) => runtime.runSync(actor.dispatch(action)),
    [actor],
  )
  return [state, dispatch] as const
}
