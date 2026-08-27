import * as React from 'react'
import { Switch, Route, Redirect, useLocation, useParams } from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import mkSearch from 'utils/mkSearch'
import parseSearch from 'utils/parseSearch'

// Legacy bucket-scoped query console routes redirect to the workspace-global
// /queries screens (the bucket is not a home for the consoles anymore), so the
// bucket segment has to survive as the console's `?bucket=` scope param.

// The workgroup/execution targets take their path segments positionally, so the
// bucket scope and any other params ride along as `search` on the redirect
// descriptor rather than through the url builder.
function withBucketScope(pathname, bucket, search) {
  return { pathname, search: mkSearch({ bucket, ...parseSearch(search, true) }) }
}

export function AthenaWorkgroupRedirect() {
  const { bucket, workgroup } = useParams()
  const { search } = useLocation()
  const { urls } = NamedRoutes.use()
  return (
    <Redirect
      to={withBucketScope(urls.queriesAthenaWorkgroup(workgroup), bucket, search)}
    />
  )
}

export function AthenaExecutionRedirect() {
  const { bucket, workgroup, queryExecutionId } = useParams()
  const { search } = useLocation()
  const { urls } = NamedRoutes.use()
  return (
    <Redirect
      to={withBucketScope(
        urls.queriesAthenaExecution(workgroup, queryExecutionId),
        bucket,
        search,
      )}
    />
  )
}

export function AthenaRootRedirect() {
  const { bucket } = useParams()
  const { search } = useLocation()
  const { urls } = NamedRoutes.use()
  // The bucket segment becomes the console's `?bucket=` scope param (keeping
  // `?table=` tabulator deep links alive); the rest of the search is preserved.
  const params = parseSearch(search, true)
  return <Redirect to={urls.queriesAthena({ bucket, ...params })} />
}

export function BucketQueriesRedirect() {
  const { paths, urls } = NamedRoutes.use()
  return (
    <Switch>
      <Route path={paths.bucketESQueries} exact>
        <Redirect to={urls.queriesEs()} />
      </Route>
      <Route path={paths.bucketAthenaExecution} exact>
        <AthenaExecutionRedirect />
      </Route>
      <Route path={paths.bucketAthenaWorkgroup} exact>
        <AthenaWorkgroupRedirect />
      </Route>
      <Route>
        <AthenaRootRedirect />
      </Route>
    </Switch>
  )
}
