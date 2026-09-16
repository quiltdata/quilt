import * as React from 'react'

import Placeholder from 'components/Placeholder'
import requireAuth from 'containers/Auth/wrapper'
import * as DP from 'model/DataProducts'
import * as RT from 'utils/reactTools'

/**
 * Kind dispatch for `/b/:bucket`.
 *
 * The volume model widens the bucket model, so one route serves both kinds and the
 * *kind* decides which layout mounts. Three properties matter, and two of them are
 * about what happens for a **bucket**:
 *
 * 1. **A bucket must reach `Bucket` unchanged**, and must not wait. `children` is
 *    rendered on the first pass, before the lookup has answered, so a bucket page
 *    mounts exactly as it does on `dev` — same tree, same timing. An earlier shape
 *    suspended here first, which replaced every bucket page with a Placeholder
 *    until the lookup resolved and remounted `<Bucket />` (losing its state) on a
 *    workspace switch. Hence `useVolume` does not suspend: see its own note.
 * 2. **A product must never reach `Bucket`.** Everything in that tree calls S3 or
 *    GraphQL for a bucket by this name, and a `volume_id` is not one. So the
 *    product branch replaces `children` outright rather than wrapping it.
 * 3. **A product screen requires auth.** `Bucket` is `protect`, which on an OPEN
 *    stack is the identity, so an unguarded product branch would show Definition,
 *    Sharing and Access to an anonymous visitor. The product layout below is
 *    wrapped in `requireAuth`, matching `/exchange` and `/products/new`.
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
  // Does not suspend: `volume` is null until the lookup answers, and null again if
  // it failed.
  const volume = DP.useVolume(bucket)

  if (volume && DP.isProduct(volume)) return <ProductVolume product={volume} />

  // Not a product, not answered yet, or the lookup failed: the bucket route, with
  // nothing added. Rendering `children` before the lookup answers is the point —
  // holding it back is the wait property 1 forbids — and a failed lookup landing
  // here is deliberate: the worst a registry outage can do to `/b/:bucket` is render
  // the bucket page. The cost is that a product URL shows the bucket page for the
  // frames before the lookup resolves.
  return <>{children}</>
}
