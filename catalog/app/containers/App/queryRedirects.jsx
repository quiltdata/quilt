import * as React from 'react'
import { Switch, Route, Redirect, useLocation, useParams } from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'

// Legacy bucket-scoped query console routes redirect to the workspace-global
// /queries screens (the bucket is not a home for the consoles anymore). These
// components are extracted from App.jsx unchanged so their redirect targets are
// unit-testable; App.jsx wires them at `paths.bucketQueries` exactly as before.

export function AthenaWorkgroupRedirect() {
  const { workgroup } = useParams()
  const { urls } = NamedRoutes.use()
  return <Redirect to={urls.queriesAthenaWorkgroup(workgroup)} />
}

export function AthenaExecutionRedirect() {
  const { workgroup, queryExecutionId } = useParams()
  const { urls } = NamedRoutes.use()
  return <Redirect to={urls.queriesAthenaExecution(workgroup, queryExecutionId)} />
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
