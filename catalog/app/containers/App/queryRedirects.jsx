import * as React from 'react'
import { Switch, Route, Redirect, useLocation, useParams } from 'react-router-dom'

import mkSearch from 'utils/mkSearch'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'

// Legacy bucket-scoped query console routes redirect to the workspace-global
// /queries screens (the bucket is not a home for the consoles anymore). These
// components are extracted from App.jsx unchanged so their redirect targets are
// unit-testable; App.jsx wires them at `paths.bucketQueries` exactly as before.

// The bucket segment becomes the console's `?bucket=` scope param on every shape
// below, because that param is what makes the bucket's `ui.athena` preferences
// apply — a workgroup or execution link that dropped it would land the reader in
// the same console, unscoped.
function useScopeSearch() {
  const { bucket } = useParams()
  const { search } = useLocation()
  return mkSearch({ bucket, ...parseSearch(search, true) })
}

export function AthenaWorkgroupRedirect() {
  const { workgroup } = useParams()
  const { urls } = NamedRoutes.use()
  const search = useScopeSearch()
  return <Redirect to={{ pathname: urls.queriesAthenaWorkgroup(workgroup), search }} />
}

export function AthenaExecutionRedirect() {
  const { workgroup, queryExecutionId } = useParams()
  const { urls } = NamedRoutes.use()
  const search = useScopeSearch()
  return (
    <Redirect
      to={{
        pathname: urls.queriesAthenaExecution(workgroup, queryExecutionId),
        search,
      }}
    />
  )
}

export function AthenaRootRedirect() {
  const { bucket } = useParams()
  const { search } = useLocation()
  const { urls } = NamedRoutes.use()
  // Through the route builder rather than `useScopeSearch`, so `?table=`
  // tabulator deep links keep their declared shape.
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
