import * as React from 'react'
import { Redirect } from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import * as DP from 'model/DataProducts'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

import ProductVolume from './ProductVolume'

/**
 * Kind dispatch for `/b/:bucket`.
 *
 * The volume model widens the bucket model, so one route serves both kinds and the
 * *kind* decides which layout mounts. Two properties matter here, and both are
 * about what happens for a **bucket**:
 *
 * 1. **A bucket must reach `Bucket` unchanged.** Not "equivalently" — the same
 *    component tree, so `BucketPreferences.Provider`, the existence probe and the
 *    tab set are exactly what they are on `dev`. This component therefore renders
 *    `children` untouched for anything that is not a known product.
 * 2. **A product must never reach `Bucket`.** Everything in that tree calls S3 or
 *    GraphQL for a bucket by this name, and a `volume_id` is not one.
 *
 * The dispatch asks the registry (here, the fixture adapter) rather than pattern-
 * matching the id. The `fixture-` prefix on every fixture id is a safety belt
 * against shadowing a real bucket name, not the mechanism: with a real adapter the
 * answer is the registry's, and a prefix rule would then be wrong.
 *
 * Order matters for a bucket: the product lookup suspends, and a bucket page must
 * not wait on it. `useVolume` resolves from one cached list, so the cost is one
 * fetch for the session rather than one per navigation — but the flag is read first
 * and short-circuits the whole thing when the preview is off, so a deployment with
 * products disabled makes no lookup at all.
 */
export default function VolumeRoute({
  bucket,
  children,
}: {
  bucket: string
  children: React.ReactNode
}) {
  const volume = DP.useVolume(bucket)

  // Not a product: hand the bucket route straight through, with nothing added.
  if (!volume || volume.kind !== 'PRODUCT') return <>{children}</>

  return <ProductVolume product={volume} />
}

/**
 * The product surfaces that are the workspace's rather than a volume's.
 *
 * `/exchange` and `/products/new` are top-level because the listing spans volumes
 * the workspace does not hold, and creation precedes any volume existing.
 *
 * Lazy so the fixture tables and these screens stay out of the bundle a browser
 * downloads for the volume list. That was a real regression once: the fixture data
 * shipped to every visitor of the landing page.
 */
const Exchange = RT.mkLazy(() => import('./Exchange'), Placeholder)
const NewProduct = RT.mkLazy(() => import('./NewProduct'), Placeholder)

export { Exchange, NewProduct }

/**
 * The retired `/data-products` family.
 *
 * Redirects to the volume list rather than 404ing: the pre-pivot links pointed at
 * products that are now reached on the bucket route, and there is no id mapping
 * from the old synthetic ids to `volume_id`s, so the list is the honest landing.
 */
export function LegacyRedirect() {
  const { urls } = NamedRoutes.use()
  return <Redirect to={urls.buckets()} />
}
