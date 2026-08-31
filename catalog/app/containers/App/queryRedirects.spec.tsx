import * as React from 'react'
import { MemoryRouter, Route, Switch, useLocation } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  bucketAthenaExecution,
  bucketAthenaWorkgroup,
  bucketESQueries,
  bucketQueries,
  queriesAthena,
  queriesAthenaExecution,
  queriesAthenaWorkgroup,
  queriesEs,
} from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import { BucketQueriesRedirect } from './queryRedirects'

// The exact set of routes the redirect reads (paths it matches on) and writes
// (workspace-global targets it redirects to).
const routes = {
  bucketAthenaExecution,
  bucketAthenaWorkgroup,
  bucketESQueries,
  bucketQueries,
  queriesAthena,
  queriesAthenaExecution,
  queriesAthenaWorkgroup,
  queriesEs,
}

function LocationDisplay() {
  const { pathname, search } = useLocation()
  return <div data-testid="loc">{pathname + search}</div>
}

// Wire BucketQueriesRedirect at the legacy bucket-queries mount point exactly as
// App.jsx does, then read where a legacy URL lands after the redirect resolves.
function landingAt(entry: string): string {
  const { getByTestId } = render(
    <MemoryRouter initialEntries={[entry]}>
      <NamedRoutes.Provider routes={routes}>
        <Switch>
          <Route path={bucketQueries.path}>
            <BucketQueriesRedirect />
          </Route>
          <Route>
            <LocationDisplay />
          </Route>
        </Switch>
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
  return getByTestId('loc').textContent ?? ''
}

describe('containers/App/queryRedirects', () => {
  afterEach(cleanup)

  it('promotes the bucket to ?bucket= and preserves other query params', () => {
    expect(landingAt('/b/my-bucket/queries/athena?table=drugs')).toBe(
      '/queries/athena?bucket=my-bucket&table=drugs',
    )
  })

  it('redirects the bare athena console, carrying only the bucket', () => {
    expect(landingAt('/b/my-bucket/queries')).toBe('/queries/athena?bucket=my-bucket')
  })

  it('redirects the ES console', () => {
    expect(landingAt('/b/my-bucket/queries/es')).toBe('/queries/es')
  })

  // Every athena shape carries the bucket: the console is workspace-global, so
  // `?bucket=` is what keeps it scoped to the bucket the legacy link named.
  it('redirects an athena workgroup, carrying the bucket', () => {
    expect(landingAt('/b/my-bucket/queries/athena/primary')).toBe(
      '/queries/athena/primary?bucket=my-bucket',
    )
  })

  it('redirects an athena query execution, carrying the bucket', () => {
    expect(landingAt('/b/my-bucket/queries/athena/primary/exec-1')).toBe(
      '/queries/athena/primary/exec-1?bucket=my-bucket',
    )
  })

  // The bucket in the path is the authoritative one: it is the route being
  // redirected from, so it outranks a `?bucket=` riding along in the query
  // string. Only the athena root ever honoured that param before; the other two
  // shapes dropped the search entirely and landed unscoped.
  it.each([
    [
      'a workgroup URL',
      '/b/source/queries/athena/primary?bucket=other',
      '/queries/athena/primary?bucket=source',
    ],
    [
      'an execution URL',
      '/b/source/queries/athena/primary/exec-1?bucket=other',
      '/queries/athena/primary/exec-1?bucket=source',
    ],
    [
      'the athena root',
      '/b/source/queries/athena?bucket=other',
      '/queries/athena?bucket=source',
    ],
  ])(
    'keeps the route bucket ahead of one in the query string on %s',
    (_label, from, to) => {
      expect(landingAt(from)).toBe(to)
    },
  )

  // Only the athena root takes a `?table=` deep link. Carrying one onto an
  // execution would fire the Tabulator autofill over the SQL of the execution
  // being viewed, so these two shapes take the scope and nothing else.
  it.each([
    [
      'a workgroup URL',
      '/b/my-bucket/queries/athena/primary?table=drugs',
      '/queries/athena/primary?bucket=my-bucket',
    ],
    [
      'an execution URL',
      '/b/my-bucket/queries/athena/primary/exec-1?table=drugs',
      '/queries/athena/primary/exec-1?bucket=my-bucket',
    ],
  ])('drops ?table= on %s, keeping the bucket scope', (_label, from, to) => {
    expect(landingAt(from)).toBe(to)
  })
})
