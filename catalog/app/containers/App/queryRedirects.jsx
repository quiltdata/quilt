import * as React from 'react'
import { Switch, Route, Redirect, useLocation, useParams } from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'

// Legacy bucket-scoped query console routes redirect to the workspace-global
// /queries screens (the bucket is not a home for the consoles anymore), so the
// bucket segment has to survive as the console's `?bucket=` scope param.

// The path segment is the bucket the user actually navigated to, so it wins over
// any `?bucket=` already in the search — spread the incoming params first.
function scoped(bucket, search) {
  return { ...parseSearch(search, true), bucket }
}

export function AthenaWorkgroupRedirect() {
  const { bucket, workgroup } = useParams()
  const { search } = useLocation()
  const { urls } = NamedRoutes.use()
  return <Redirect to={urls.queriesAthenaWorkgroup(workgroup, scoped(bucket, search))} />
}

export function AthenaExecutionRedirect() {
  const { bucket, workgroup, queryExecutionId } = useParams()
  const { search } = useLocation()
  const { urls } = NamedRoutes.use()
  return (
    <Redirect
      to={urls.queriesAthenaExecution(
        workgroup,
        queryExecutionId,
        scoped(bucket, search),
      )}
    />
  )
}

export function AthenaRootRedirect() {
  const { bucket } = useParams()
  const { search } = useLocation()
  const { urls } = NamedRoutes.use()
  return <Redirect to={urls.queriesAthena(scoped(bucket, search))} />
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
