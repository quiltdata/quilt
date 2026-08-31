import * as React from 'react'
import { act, renderHook } from '@testing-library/react-hooks'
import { describe, expect, it, vi } from 'vitest'

import noop from 'utils/noop'

import * as Model from './'

vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: vi.fn(() => ({
    urls: {
      queriesAthenaExecution: () => 'execution-route',
      queriesAthenaWorkgroup: () => 'workgroup-route',
    },
  })),
}))

const useParams = vi.fn(
  () =>
    ({
      workgroup: 'w',
    }) as Record<string, string>,
)

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => useParams(),
  useLocation: () => ({ search: '' }),
  Redirect: () => null,
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

describe('app/containers/Queries/Athena/model/state', () => {
  it('load workgroups and set current workgroup', async () => {
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

  it('threads the bucket default workgroup through to the model', async () => {
    // The seam this branch exists to restore: `Provider` takes `ui.athena` from
    // the `?bucket=` scope's preferences and hands the default workgroup to
    // `useWorkgroup`. Nothing crossed it, so the prop could have been dropped on
    // the floor and every test here would still have passed.
    // A workgroup *is* named, but it is one this user cannot reach — a bookmark
    // from before access changed. Without a named workgroup the provider
    // redirects instead of rendering, so this is also the shape that lets the
    // default be observed at all.
    useParams.mockImplementation(() => ({ workgroup: 'gone' }) as Record<string, string>)
    listWorkGroups.mockImplementation(() => ({
      promise: () =>
        Promise.resolve({
          WorkGroups: [{ Name: 'alpha' }, { Name: 'team' }],
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
      return { abort: noop }
    })
    listQueryExecutions.mockImplementation((_x, cb) => {
      cb(undefined, { QueryExecutionIds: [] })
      return { abort: noop }
    })
    listDataCatalogs.mockImplementation(() => ({
      promise: () => Promise.resolve({ DataCatalogsSummary: [] }),
    }))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Model.Provider preferences={{ defaultWorkgroup: 'team' }}>
        {children}
      </Model.Provider>
    )
    const { result, waitFor, unmount } = renderHook(() => Model.useState(), { wrapper })
    await act(async () => {
      await waitFor(() => typeof result.current.workgroup.data === 'string')
    })
    // 'alpha' is first in the list, so this is the default being honored rather
    // than the fallback happening to agree.
    expect(result.current.workgroup.data).toBe('team')
    unmount()
    useParams.mockImplementation(() => ({ workgroup: 'w' }) as Record<string, string>)
  })
})
