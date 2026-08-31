import * as React from 'react'
import * as RRDom from 'react-router-dom'

/**
 * The bucket the Athena console is scoped to, or `null` when it is scoped to no
 * bucket.
 *
 * The console is workspace-global, while `ui.athena` and tabulator tables are
 * per-bucket — so a bucket reaches the console as a `?bucket=` search param, set
 * by the bucket-page deep links and by the legacy `/b/:bucket/queries/...`
 * redirects. Read it here rather than at each consumer: the console branches on
 * the scope in more than one place, and the two must not disagree.
 */
export function useBucketScope(): string | null {
  const location = RRDom.useLocation()
  return React.useMemo(
    () => new URLSearchParams(location.search).get('bucket'),
    [location.search],
  )
}
