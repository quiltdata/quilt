import * as React from 'react'

import Placeholder from 'components/Placeholder'
import requireAuth from 'containers/Auth/wrapper'
import * as DP from 'model/DataProducts'
import * as RT from 'utils/reactTools'

/**
 * Kind dispatch for `/b/:bucket`.
 *
 * The volume model widens the bucket model, so one route serves both kinds and the
 * *kind* decides which layout mounts. Three properties matter, and the first two
 * pull against each other:
 *
 * 1. **A product must never mount `Bucket`.** Everything in that tree calls S3 or
 *    GraphQL for a bucket by this name: `useBucketExistence` (`headBucket`),
 *    `BucketPreferences.Provider` (a config object in the bucket), the tab queries.
 *    A `volume_id` is not a bucket, so those calls fail — and `BucketCache` caches
 *    the failure as `Err` for the session, so it is not even a free mistake.
 * 2. **A bucket must not lose state to the lookup.** It must not unmount and
 *    remount when the workspace changes, which would discard whatever the page
 *    holds.
 *
 * Both orderings fail one of these. Rendering `children` first mounts `Bucket` for
 * a product during the lookup (1); holding `children` back until the lookup answers
 * replaces every bucket page with a Placeholder and remounts it on a workspace
 * switch (2).
 *
 * So the dispatch waits, and then **pins its answer per id**: the first settled
 * lookup for an id decides, and `decided` keeps that decision across later renders.
 * A workspace switch re-keys the cache and un-settles the read, but the pinned
 * decision means `Bucket` stays mounted — the switch cannot make it flicker,
 * because nothing asks the question again. The wait is one macrotask plus a chunk
 * load on first navigation to an id, and it buys never calling S3 with a product
 * id.
 *
 * 3. **A product screen requires auth.** `Bucket` is `protect`, which on an OPEN
 *    stack is the identity, so an unguarded product branch would show Definition,
 *    Sharing and Access to an anonymous visitor.
 *
 * The dispatch asks the registry (here, the fixture adapter) rather than pattern-
 * matching the id. The `fixture-` prefix on every fixture id is a safety belt
 * against shadowing a real bucket name, not the mechanism: with a real adapter the
 * answer is the registry's, and a prefix rule would then be wrong.
 */

/**
 * The product layout, gated and lazy.
 *
 * `requireAuth` wraps the lazy component rather than the branch below, so the
 * redirect to sign-in happens before any product screen renders — and so the chunk
 * is still only fetched for a product URL.
 */
const ProductVolume = requireAuth<{ product: DP.ProductVolume }>()(
  RT.mkLazy(() => import('./ProductVolume'), Placeholder),
)

export default function VolumeRoute({
  bucket,
  children,
}: {
  bucket: string
  children: React.ReactNode
}) {
  // Neither read suspends, so this component decides what to render rather than
  // throwing to a boundary that would take the bucket page down with it.
  const volume = DP.useVolume(bucket)
  const settled = DP.useVolumeSettled(bucket)

  // The pinned decision, per id. Reset when the id changes, never when the
  // workspace does — that asymmetry is what keeps `Bucket` mounted across a switch.
  const decided = React.useRef<{ id: string; isProduct: boolean } | null>(null)
  if (decided.current?.id !== bucket) decided.current = null
  if (settled && !decided.current) {
    decided.current = { id: bucket, isProduct: !!volume && DP.isProduct(volume) }
  }

  // Not answered yet: neither tree. A Placeholder here is the cost of property 1 —
  // mounting `Bucket` to fill the gap is what put `headBucket` on a product id.
  if (!decided.current) return <Placeholder />

  if (decided.current.isProduct && volume && DP.isProduct(volume)) {
    return <ProductVolume product={volume} />
  }

  // A bucket, or a lookup that failed. A failed lookup landing here is deliberate:
  // `useVolume` reports failure as `null`, so the worst a registry outage can do to
  // `/b/:bucket` is render the bucket page — which is what the id most likely is.
  return <>{children}</>
}
