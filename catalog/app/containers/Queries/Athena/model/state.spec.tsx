import * as React from 'react'
import { act, renderHook } from '@testing-library/react-hooks'
import { describe, expect, it, vi } from 'vitest'

import * as routes from 'constants/routes'
import noop from 'utils/noop'

import * as Model from './'

// The real url builders, so a redirect target is asserted as the URL the app
// actually navigates to rather than against a stub's own idea of the params.
vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: vi.fn(() => ({
    urls: {
      queriesAthenaExecution: routes.queriesAthenaExecution.url,
      queriesAthenaWorkgroup: routes.queriesAthenaWorkgroup.url,
    },
  })),
}))

const useParams = vi.fn(
  () =>
    ({
      workgroup: 'w',
    }) as Record<string, string>,
)

const search = vi.fn(() => '')
let redirectedTo: string | null = null

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => useParams(),
  useLocation: () => ({ search: search() }),
  Redirect: ({ to }: { to: string }) => {
    redirectedTo = to
    return null
  },
}))

const batchGetQueryExecution = vi.fn()
const getWorkGroup = vi.fn()
const listDataCatalogs = vi.fn()
const listDatabases = vi.fn()
const listQueryExecutions = vi.fn()
const listWorkGroups = vi.fn()
const getQueryExecution = vi.fn()
const listNamedQueries = vi.fn()
const batchGetNamedQuery = vi.fn()
const getQueryResults = vi.fn()
const startQueryExecution = vi.fn()

const AthenaApi = {
  batchGetNamedQuery,
  batchGetQueryExecution,
  getQueryExecution,
  getQueryResults,
  getWorkGroup,
  listDataCatalogs,
  listDatabases,
  listNamedQueries,
  listQueryExecutions,
  listWorkGroups,
  startQueryExecution,
}

vi.mock('utils/AWS', () => ({ Athena: { use: () => AthenaApi } }))

// A workspace with three workgroups, no named queries and no execution history.
function mockAthena() {
  listWorkGroups.mockImplementation(() => ({
    promise: () =>
      Promise.resolve({
        WorkGroups: [{ Name: 'foo' }, { Name: 'bar' }, { Name: 'w' }],
      }),
  }))
  getWorkGroup.mockImplementation(({ WorkGroup: Name }: { WorkGroup: string }) => ({
    promise: () =>
      Promise.resolve({
        WorkGroup: {
          Configuration: { ResultConfiguration: { OutputLocation: 'any' } },
          State: 'ENABLED',
          Name,
        },
      }),
  }))
  listNamedQueries.mockImplementation((_x, cb) => {
    cb(undefined, { NamedQueryIds: [] })
    return {
      abort: noop,
    }
  })
  listQueryExecutions.mockImplementation((_x, cb) => {
    cb(undefined, { QueryExecutionIds: [] })
    return {
      abort: noop,
    }
  })
  listDataCatalogs.mockImplementation(() => ({
    promise: () => Promise.resolve({ DataCatalogsSummary: [] }),
  }))
  listDatabases.mockImplementation(() => ({
    promise: () => Promise.resolve({ DatabaseList: [] }),
  }))
}

describe('app/containers/Queries/Athena/model/state', () => {
  it('load workgroups and set current workgroup', async () => {
    mockAthena()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Model.Provider>{children}</Model.Provider>
    )
    const { result, waitFor, unmount } = renderHook(() => Model.useState(), { wrapper })
    await act(async () => {
      await waitFor(() => typeof result.current.executions.data === 'object')
    })
    expect(result.current.workgroups.data).toMatchObject({ list: ['bar', 'foo', 'w'] })
    expect(result.current.workgroup.data).toBe('w')
    unmount()
  })

  it('redirects to the resolved workgroup through the url builder, keeping the console scope', async () => {
    mockAthena()
    // No `workgroup` in the path: the provider resolves one and redirects to it.
    useParams.mockReturnValue({})
    search.mockReturnValue('?bucket=my-bucket&table=drugs')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Model.Provider>{children}</Model.Provider>
    )
    const { waitFor, unmount } = renderHook(() => Model.useState(), { wrapper })
    await act(async () => {
      await waitFor(() => redirectedTo !== null)
    })

    expect(redirectedTo).toBe('/queries/athena/bar?bucket=my-bucket&table=drugs')
    unmount()
  })
})
