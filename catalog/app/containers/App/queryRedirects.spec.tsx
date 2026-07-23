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

  it('redirects an athena workgroup, dropping the bucket', () => {
    expect(landingAt('/b/my-bucket/queries/athena/primary')).toBe(
      '/queries/athena/primary',
    )
  })

  it('redirects an athena query execution', () => {
    expect(landingAt('/b/my-bucket/queries/athena/primary/exec-1')).toBe(
      '/queries/athena/primary/exec-1',
    )
  })
})
