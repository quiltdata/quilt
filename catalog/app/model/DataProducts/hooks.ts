/**
 * The hooks containers use to reach the volume model.
 *
 * These are the only sanctioned way in. A container that imports `fixtures`
 * directly has bypassed the port, and the day a real adapter lands that container
 * silently keeps reading fixtures -- exactly the failure the port exists to
 * prevent.
 *
 * Built on `utils/ResourceCache` rather than a bespoke `useEffect` + `useState`
 * pair, for the same reason `CatalogSettings` is: the cache dedupes concurrent
 * reads of the same key, survives unmount/remount, and suspends rather than
 * making every call site render a spinner branch by hand. The volume list and a
 * product's own screens both ask for volumes; with the cache that is one fetch.
 *
 * The reads suspend. They are safe wherever `CatalogSettings.use()` is safe --
 * inside the app's root Suspense boundary, which is everywhere these render.
 *
 * The writes do **not** suspend and are not cached: they are one-shot acts a
 * button triggers, and caching a write result would replay it on remount.
 */

import * as React from 'react'

import * as Cache from 'utils/ResourceCache'

import type {
  DataProductAdapter,
  DefinitionCheck,
  PublishingAdapter,
  SubscribingAdapter,
  WriteFailure,
} from './adapter'
import { supportsPublishing, supportsSubscribing } from './adapter'
import { makeFixtureAdapter } from './fixtureAdapter'
import * as fixtures from './fixtures'
import type { ProductVolume, Volume } from './types'

/**
 * Whether the data these hooks return is fixture data.
 *
 * Read by every surface that renders the notice. A constant beside the adapter
 * choice rather than a hand-set boolean elsewhere, so the two cannot drift: the
 * day a registry-backed adapter is selected below, this flips with it, and there
 * is no path where fixture data loses the label or a real adapter wears it.
 */
export const IS_FIXTURE_DATA = true

/**
 * The active workspace, and switching it.
 *
 * A module-level value with subscribers rather than a React context, matching how
 * the adapter is chosen: there is exactly one active workspace (model.md
 * invariant 9), and a context would invite per-subtree overriding -- which sounds
 * flexible and in practice means two panes disagreeing about who is acting.
 *
 * In the real catalog this is `Me.role` and `switchRole`, which already exist. The
 * switcher is here so the prototype can *show* the rule: the same product wears
 * the publisher face for one workspace and the subscriber face for the other, and
 * neither list ever contains the other's holdings.
 */
let activeWorkspace = fixtures.DEFAULT_WORKSPACE
const workspaceListeners = new Set<() => void>()

/**
 * Which adapter the hooks read from, rebuilt when the workspace changes.
 *
 * Bound to a workspace rather than taking one per call: there is no legitimate
 * read that spans two workspaces, and an adapter that took it as an argument would
 * put a unioned read one typo away.
 *
 * When a GraphQL-backed adapter lands this becomes a build- or config-time choice
 * here, and no container changes. That is the whole point of the port.
 */
let adapter: DataProductAdapter = makeFixtureAdapter(activeWorkspace)

export function setActiveWorkspace(name: string) {
  if (name === activeWorkspace) return
  activeWorkspace = name
  adapter = makeFixtureAdapter(name)
  workspaceListeners.forEach((l) => l())
}

/** The workspaces this deployment offers a switch between. */
export const WORKSPACES = fixtures.WORKSPACES

// The cache keys on `input`; these resources take none beyond the ids below, so
// `key` is explicit rather than relying on `R.identity` over an object.
//
// `enabled` is part of the key, not a call-site branch, because hooks cannot be
// called conditionally: a caller gated on a feature flag still has to call the
// hook every render. Keying on it means the disabled case resolves to `[]`
// **without touching the adapter**, so a deployment with the feature off makes no
// request once a real adapter lands. Gating at the call site instead would fetch
// first and discard after.
//
// The `@ts-expect-error`s are the repo's existing shape for this:
// `utils/ResourceCache` is untyped JS and declares `key` as `R.identity`
// (`<T>(a: T) => T`), so any narrowing key function fails to assign. Same
// suppression `CatalogSettings` uses for the same reason.
// Every read is keyed on the active workspace as well as its own inputs. Not
// decoration: `utils/ResourceCache` has no invalidation API, so a key that omitted
// the workspace would serve one workspace's holdings under another's name after a
// switch -- the unioned-view failure by a slower route. Keying on it makes the
// switch a cache miss instead.
interface ListInput {
  enabled: boolean
  workspace: string
}

const VolumesResource = Cache.createResource({
  name: 'DataProducts.volumes',
  fetch: ({ enabled }: ListInput) =>
    enabled ? adapter.listVolumes() : Promise.resolve([]),
  // @ts-expect-error
  key: ({ enabled, workspace }: ListInput) => `${workspace}::${enabled}`,
})

const ExchangeResource = Cache.createResource({
  name: 'DataProducts.exchange',
  fetch: ({ enabled }: ListInput) =>
    enabled ? adapter.listExchange() : Promise.resolve([]),
  // @ts-expect-error
  key: ({ enabled, workspace }: ListInput) => `${workspace}::${enabled}`,
})

const VolumeResource = Cache.createResource({
  name: 'DataProducts.volume',
  fetch: ({ id }: { id: string; workspace: string }) => adapter.getVolume(id),
  // @ts-expect-error
  key: ({ id, workspace }: { id: string; workspace: string }) => `${workspace}::${id}`,
})

/**
 * Every volume the active workspace holds, both kinds.
 *
 * `enabled` exists because hooks cannot be called conditionally: a caller gated on
 * a feature flag still runs this every render. Passing `false` resolves to `[]`
 * without reaching the adapter.
 */
export function useVolumes(enabled = true): Volume[] {
  const workspace = useActiveWorkspace()
  return Cache.useData(
    VolumesResource,
    { enabled, workspace },
    { suspend: true },
  ) as Volume[]
}

/** Products published in this workspace's scope, held or not. A listing, not an entitlement. */
export function useExchange(enabled = true): ProductVolume[] {
  const workspace = useActiveWorkspace()
  return Cache.useData(
    ExchangeResource,
    { enabled, workspace },
    { suspend: true },
  ) as ProductVolume[]
}

/**
 * One volume, or `null` when this stack has none with that id.
 *
 * `null` is data, not an error: increment 1 keeps no tombstone for a retired
 * product, so a retired product and a typo are indistinguishable here and the
 * screen says exactly that.
 */
export function useVolume(id: string): Volume | null {
  const workspace = useActiveWorkspace()
  return Cache.useData(
    VolumeResource,
    { id, workspace },
    { suspend: true },
  ) as Volume | null
}

/**
 * The active workspace's name, for the copy that names it on every act.
 *
 * Subscribes to the switch rather than reading the cache, so every surface
 * re-renders together when the workspace changes. Reading it from the cache
 * instead would let one pane keep the previous workspace's name beside another
 * pane's holdings, which is the unioned-view failure in miniature.
 */
export function useActiveWorkspace(): string {
  const [name, setName] = React.useState(activeWorkspace)
  React.useEffect(() => {
    const listener = () => setName(activeWorkspace)
    workspaceListeners.add(listener)
    // Re-read on subscribe: the workspace can change between render and effect.
    listener()
    return () => {
      workspaceListeners.delete(listener)
    }
  }, [])
  return name
}

/**
 * The buckets a definition may select from.
 *
 * A hook so the authoring screen does not import fixtures. It reads the
 * workspace's reach, which in a real adapter is the workspace's holdings of kind
 * bucket -- available from `useVolumes` -- but is kept a separate read because
 * the substrate tables a definition may name are the registry's answer, not a
 * client-side derivation from a list of buckets.
 */
export function useWorkspaceReach(): string[] {
  const workspace = useActiveWorkspace()
  return React.useMemo(() => fixtures.reachFor(workspace), [workspace])
}

/**
 * The adapter itself, for the one thing the read hooks cannot express: asking
 * whether a write path exists at all.
 *
 * Exposed so a container can call `supportsPublishing(useAdapter())` rather than
 * hardcoding what this deployment can do.
 */
export function useAdapter(): DataProductAdapter {
  return adapter
}

/**
 * The result of a write the user triggered: nothing yet, or the act's outcome.
 *
 * `null` is "not attempted", which is a different thing from every failure arm.
 * The screens render it as an absence rather than a state.
 */
export type WriteState<T> = null | ({ ok: true } & T) | WriteFailure

/**
 * Run one write and hold its result.
 *
 * Deliberately not a cache resource: a write is a one-shot act, and a cached one
 * would replay on remount. Deliberately not throwing either -- the port's
 * failures are typed arms a screen renders, including the `UNAVAILABLE` arm every
 * write returns on a stack with no registry API.
 *
 * `pending` is tracked even though the fixture adapter resolves on the microtask
 * queue, so the branch exists and is testable rather than being added the day a
 * real adapter makes it visible.
 */
export function useWrite<Args extends unknown[], T extends object>(
  run: ((...args: Args) => Promise<WriteState<T>>) | null,
): {
  result: WriteState<T>
  pending: boolean
  call: (...args: Args) => Promise<void>
  reset: () => void
} {
  const [result, setResult] = React.useState<WriteState<T>>(null)
  const [pending, setPending] = React.useState(false)

  const call = React.useCallback(
    async (...args: Args) => {
      if (!run) return
      setPending(true)
      try {
        setResult(await run(...args))
      } finally {
        setPending(false)
      }
    },
    [run],
  )

  const reset = React.useCallback(() => setResult(null), [])

  return { result, pending, call, reset }
}

/**
 * The publishing adapter, or null when this deployment has no write path at all.
 *
 * Null and "returns UNAVAILABLE" are different situations and the screens treat
 * them differently: null means the deployment cannot publish and the controls do
 * not belong; UNAVAILABLE means the act exists in the model and nothing serves it
 * yet, which is what the fixture adapter says and what the notice explains.
 */
export function usePublishing(): PublishingAdapter | null {
  return supportsPublishing(adapter) ? adapter : null
}

export function useSubscribing(): SubscribingAdapter | null {
  return supportsSubscribing(adapter) ? adapter : null
}

/**
 * Static checks on a draft definition.
 *
 * Debounced by the caller, not here: the screens run this on an explicit Check
 * press rather than on keystroke, because with a real adapter a check costs an
 * Athena query. The hook only holds the last answer.
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
