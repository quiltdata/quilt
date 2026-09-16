/**
 * The write side of the port: the acts a product screen triggers.
 *
 * **A module of its own for one reason: the bundle.** These hooks need a
 * *synchronous* adapter — a button asks "is there a write path" during render and
 * cannot await — so this file imports `fixtureAdapter` statically, which pulls in
 * the fixture tables. `hooks.ts` must not, because the volumes landing imports it
 * (`Buckets.jsx` → the barrel → the hooks) and would ship ~23KB of fixture data to
 * every visitor whether or not the preview is on. #5259 removed exactly that edge.
 *
 * So the split is: reads reach the adapter through a dynamic import and stay in
 * `hooks.ts`; writes live here, and only the already-lazy product screens import
 * this module. The barrel deliberately does **not** re-export it.
 *
 * The writes do not suspend and are not cached: they are one-shot acts, and a
 * cached write result would replay on remount.
 */

import * as React from 'react'

import type {
  DataProductAdapter,
  DefinitionCheck,
  PublishingAdapter,
  SubscribingAdapter,
  WriteFailure,
} from './adapter'
import { supportsPublishing, supportsSubscribing } from './adapter'
import { makeFixtureAdapter } from './fixtureAdapter'
import { useActiveWorkspace } from './hooks'

/**
 * The adapter for the active workspace.
 *
 * Rebuilt per workspace rather than taking one as an argument: there is no
 * legitimate write spanning two workspaces (model.md invariant 9), and an adapter
 * that took it as a parameter would put a cross-workspace write one typo away.
 *
 * When a GraphQL-backed adapter lands this is the one line that changes, and no
 * container moves. That is the point of the port.
 */
function useWriteAdapter(): PublishingAdapter & SubscribingAdapter {
  const workspace = useActiveWorkspace()
  return React.useMemo(() => makeFixtureAdapter(workspace), [workspace])
}

/**
 * The adapter itself, for the one question the read hooks cannot express: whether a
 * write path exists at all.
 *
 * A container calls `supportsPublishing(useAdapter())` rather than hardcoding what
 * this deployment can do.
 */
export function useAdapter(): DataProductAdapter {
  return useWriteAdapter()
}

/**
 * The publishing adapter, or null when this deployment has no write path at all.
 *
 * Null and "returns UNAVAILABLE" are different situations, and the screens treat
 * them differently: null means the deployment cannot publish and the controls do
 * not belong; UNAVAILABLE means the act exists in the model and nothing serves it
 * yet, which is what the fixture adapter says and what the notice explains.
 */
export function usePublishing(): PublishingAdapter | null {
  const adapter = useWriteAdapter()
  return supportsPublishing(adapter) ? adapter : null
}

export function useSubscribing(): SubscribingAdapter | null {
  const adapter = useWriteAdapter()
  return supportsSubscribing(adapter) ? adapter : null
}

/**
 * The result of a write the user triggered: nothing yet, or the act's outcome.
 *
 * `null` is "not attempted", which differs from every failure arm. The screens
 * render it as an absence rather than a state.
 */
export type WriteState<T> = null | ({ ok: true } & T) | WriteFailure

export interface Act<Args extends unknown[]> {
  result: WriteState<object>
  pending: boolean
  call: (...args: Args) => Promise<void>
  reset: () => void
}

/**
 * One write act, guarded on the adapter's presence.
 *
 * The guard is here rather than at each call site because it was written out
 * seventeen times — a `useCallback` returning `Promise.resolve(null)` when the
 * adapter was absent, then `useWrite(adapter ? fn : null)` guarding the same thing
 * again. Two null checks per act, six lines each, and the pair had to stay in sync.
 *
 * `pending` is tracked even though the fixture adapter resolves on the microtask
 * queue, so the branch exists and is testable rather than appearing the day a real
 * adapter makes it visible.
 */
export function useAct<A, Args extends unknown[] = []>(
  adapter: A | null,
  run: (adapter: A, ...args: Args) => Promise<WriteState<object>>,
): Act<Args> {
  const [result, setResult] = React.useState<WriteState<object>>(null)
  const [pending, setPending] = React.useState(false)
  // The callback identity must not gate the act: `run` is an inline arrow at every
  // call site, so a `useCallback` keyed on it would rebuild each render anyway.
  const runRef = React.useRef(run)
  runRef.current = run

  const call = React.useCallback(
    async (...args: Args) => {
      if (!adapter) return
      setPending(true)
      try {
        setResult(await runRef.current(adapter, ...args))
      } finally {
        setPending(false)
      }
    },
    [adapter],
  )

  const reset = React.useCallback(() => setResult(null), [])

  return { result, pending, call, reset }
}

/**
 * Static checks on a draft definition.
 *
 * The same shape as `useAct` with a typed result, so it is that hook plus the
 * check's own return value. Run on an explicit press, never on keystroke: with a
 * real registry a check costs an Athena query, and a debounce would only spend it
 * more slowly.
 */
export function useDefinitionCheck(): {
  check: DefinitionCheck | null
  pending: boolean
  run: (sql: string, reach: string[]) => Promise<void>
  reset: () => void
} {
  const publishing = usePublishing()
  const [check, setCheck] = React.useState<DefinitionCheck | null>(null)
  const [pending, setPending] = React.useState(false)

  const run = React.useCallback(
    async (sql: string, reach: string[]) => {
      if (!publishing) return
      setPending(true)
      try {
        setCheck(await publishing.checkDefinition(sql, reach))
      } finally {
        setPending(false)
      }
    },
    [publishing],
  )

  const reset = React.useCallback(() => setCheck(null), [])

  return { check, pending, run, reset }
}
