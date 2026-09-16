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
 * Most reads suspend, and are safe wherever `CatalogSettings.use()` is safe --
 * inside the app's root Suspense boundary, which is everywhere these render.
 * `useVolume` and `useVolumeSettled` are the exceptions: they sit on `/b/:bucket`,
 * which is the bucket page for every id that is not a product, so they report
 * pending and failed reads as values rather than throwing. See their own notes.
 *
 * The write hooks live in `./writes`, not here -- they need a synchronous adapter,
 * which means a static fixtures import, which this module must not have.
 */

import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'
import * as Cache from 'utils/ResourceCache'

import type { PublishingAdapter, SubscribingAdapter } from './adapter'
import type { ProductVolume, Volume } from './types'
import { DEFAULT_WORKSPACE, WORKSPACES as WORKSPACE_NAMES } from './workspaces'

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
let activeWorkspace = DEFAULT_WORKSPACE
const workspaceListeners = new Set<() => void>()

/**
 * The adapter, loaded on demand and bound to one workspace.
 *
 * **Dynamically imported, and that is load-bearing rather than tidy.**
 * `Buckets.jsx` imports the barrel, the barrel imports these hooks, so a static
 * edge from here to `fixtureAdapter` -> `fixtures` puts ~1300 lines of fixture
 * data in the volumes-landing chunk every visitor downloads, flag on or off.
 * #5259 removed exactly that edge; a later refactor put it back. The dynamic
 * import is what keeps it out, so this must not become a top-level `import`.
 *
 * Bound to a workspace rather than taking one per call at the adapter's own
 * boundary: there is no legitimate read spanning two workspaces. The *cache*
 * resources below still thread the workspace through `fetch`, because the module
 * binding is mutable and a fetch that read it could resolve against a workspace
 * the key does not name.
 *
 * When a GraphQL-backed adapter lands this becomes a build- or config-time choice
 * here, and no container changes. That is the whole point of the port.
 */
const loadAdapter = (
  workspace: string,
): Promise<PublishingAdapter & SubscribingAdapter> =>
  import('./fixtureAdapter').then((m) => m.makeFixtureAdapter(workspace))

export function setActiveWorkspace(name: string) {
  if (name === activeWorkspace) return
  activeWorkspace = name
  workspaceListeners.forEach((l) => l())
}

/** The workspaces this deployment offers a switch between. */
export const WORKSPACES = WORKSPACE_NAMES

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

// Every fetch takes its workspace from `input` -- the same value the key names --
// and never from the module binding. That is the point: `createResource` defers its
// fetch a macrotask, so a switch inside that window would have a fetch read the
// *new* binding and cache the result under the *old* workspace's key. The cache has
// no invalidation, so that entry would then serve one workspace's projection under
// the other's name, including the `requests`/`subscribers` arrays DEC-52 exists to
// withhold.
const VolumesResource = Cache.createResource({
  name: 'DataProducts.volumes',
  fetch: ({ enabled, workspace }: ListInput) =>
    enabled ? loadAdapter(workspace).then((a) => a.listVolumes()) : Promise.resolve([]),
  // @ts-expect-error
  key: ({ enabled, workspace }: ListInput) => `${workspace}::${enabled}`,
})

const ExchangeResource = Cache.createResource({
  name: 'DataProducts.exchange',
  fetch: ({ enabled, workspace }: ListInput) =>
    enabled ? loadAdapter(workspace).then((a) => a.listExchange()) : Promise.resolve([]),
  // @ts-expect-error
  key: ({ enabled, workspace }: ListInput) => `${workspace}::${enabled}`,
})

interface VolumeInput {
  id: string
  workspace: string
}

const VolumeResource = Cache.createResource({
  name: 'DataProducts.volume',
  fetch: ({ id, workspace }: VolumeInput) =>
    loadAdapter(workspace).then((a) => a.getVolume(id)),
  // @ts-expect-error
  key: ({ id, workspace }: VolumeInput) => `${workspace}::${id}`,
})

// Reads the fixture table directly rather than the port, which is a gap: the reach
// is the registry's answer, and `DataProductAdapter` has no method for it. Dynamic
// so it stays out of the landing chunk like the rest. When the port grows a
// `workspaceReach()`, this becomes a `loadAdapter(workspace)` call like its siblings.
const ReachResource = Cache.createResource({
  name: 'DataProducts.reach',
  fetch: ({ workspace }: { workspace: string }) =>
    import('./fixtures').then((m) => m.reachFor(workspace)),
  // @ts-expect-error
  key: ({ workspace }: { workspace: string }) => workspace,
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
 *
 * **A failed read is also `null`, deliberately.** This hook sits on `/b/:bucket`,
 * which is the bucket page for every id that is not a product, and `suspend`
 * rethrows the cache's `Err` arm. With no error boundary between `App` and
 * `Bucket`, a registry that 500s would take the whole catalog down on a plain
 * bucket URL. Degrading to `null` means the worst a failed lookup can do is render
 * the bucket page -- which is what the id most likely is.
 *
 * The cost is that a product briefly looks like a bucket during an outage. That is
 * the right way round: a product route that fails renders a bucket page and says
 * so, where the alternative takes down every bucket page on the stack.
 */
export function useVolume(id: string): Volume | null {
  const entry = useVolumeEntry(id)
  return AsyncResult.case(
    {
      Ok: (v: Volume | null) => v,
      // Init and Pending are "not answered yet". Not suspended on: see above --
      // this must not hold up the bucket page it shares a route with.
      _: () => null,
    },
    entry.result,
  ) as Volume | null
}

/**
 * Whether the volume lookup has settled.
 *
 * Separate from `useVolume` so a caller can tell "not a product" from "not known
 * yet" -- the two look identical in a `null`. `VolumeRoute` needs that difference:
 * it must not mount `Bucket` for an id that turns out to be a product, because
 * every call in that tree would run against a `volume_id`.
 */
export function useVolumeSettled(id: string): boolean {
  const entry = useVolumeEntry(id)
  return AsyncResult.case(
    { Ok: () => true, Err: () => true, _: () => false },
    entry.result,
  ) as boolean
}

/**
 * The cache entry both non-suspending volume reads share.
 *
 * The `promise` rejection is consumed here. `suspend` would have rethrown it, but
 * these hooks read `result` instead and never touch `promise`, so a failed lookup
 * left the deferred promise unhandled and logged an unhandled rejection on top of
 * the failure it already reported as `null`. `catch` with an empty handler is the
 * whole fix: the error is already carried in `result`, and this only stops the
 * runtime from also reporting it as unobserved.
 */
function useVolumeEntry(id: string) {
  const workspace = useActiveWorkspace()
  const entry = Cache.useData(VolumeResource, { id, workspace }) as {
    result: unknown
    promise?: Promise<unknown>
  }
  React.useEffect(() => {
    entry.promise?.catch(() => {})
  }, [entry])
  return entry as { result: unknown }
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
  return Cache.useData(ReachResource, { workspace }, { suspend: true }) as string[]
}
