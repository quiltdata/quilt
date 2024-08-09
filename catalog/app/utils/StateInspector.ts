import * as Eff from 'effect'

// process.env.NODE_ENV === 'development' ? 'trace' : 'info'
//
// instantiate the inspector:
// import * as Inspect from '@statelyai/inspect'
// const inspector = Inspect.createBrowserInspector()
//
// register an actor:
// inspector.actor('dummy', {
//   status: 'active',
// })
//
// register a communication event:
// inspector.event(
//   id,
//   { type: (action as any)._tag, ...action },
//   { source: 'dummy' },
// )
//
// send a state snapshot update:
// yield* Eff.Effect.forkDaemon(
//   Eff.Stream.runForEach(stateRef.changes, (s) =>
//     Eff.Effect.sync(() => inspector.snapshot(id, { context: s })),
//   ),
// )

export class StateInspector extends Eff.Context.Tag('StateInspector')<
  StateInspector,
  {
    actor: () => Eff.Effect.Effect<void>
    event: () => Eff.Effect.Effect<void>
    snapshot: () => Eff.Effect.Effect<void>
  }
>() {}

// TODO:
// - [ ] expose as a global, start on-demand
