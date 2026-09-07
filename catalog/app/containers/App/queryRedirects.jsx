import * as React from 'react'
import { Switch, Route, Redirect, useLocation, useParams } from 'react-router-dom'

import mkSearch from 'utils/mkSearch'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'

// Legacy bucket-scoped query console routes redirect to the workspace-global
// /queries screens (the bucket is not a home for the consoles anymore). These
// components live outside App.jsx so their redirect targets are unit-testable;
// App.jsx wires them at `paths.bucketQueries`.

// The bucket segment becomes the console's `?bucket=` scope param: the console
// is workspace-global, so that param is what keeps it pointed at the bucket the
// legacy link named.
function useScopeSearch() {
  const { bucket } = useParams()
  // The scope and nothing else. These two routes declare no other search param,
  // and carrying a `?table=` onto an execution would fire the Tabulator autofill
  // over the SQL of the execution being viewed.
  return mkSearch({ bucket })
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
  // The builder keeps `{ bucket, table }`, so the `?table=` tabulator deep links
  // this shape carries survive. `bucket` last: the path being redirected from
  // outranks a `?bucket=` arriving in the query string.
  const params = parseSearch(search, true)
  return <Redirect to={urls.queriesAthena({ ...params, bucket })} />
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
