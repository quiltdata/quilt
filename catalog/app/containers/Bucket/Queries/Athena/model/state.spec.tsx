import * as React from 'react'
import { render } from '@testing-library/react'
import { act, renderHook } from '@testing-library/react-hooks'
import { describe, expect, it, vi } from 'vitest'

import * as Model from './'

vi.mock('utils/NamedRoutes', async () => {
  const actual = await vi.importActual('utils/NamedRoutes')
  return {
    ...actual,
    use: vi.fn(() => ({
      urls: {
        bucketAthenaExecution: () => 'bucket-route',
        bucketAthenaWorkgroup: () => 'workgroup-route',
      },
    })),
  }
})

const useParams = vi.fn(
  () =>
    ({
      bucket: 'b',
      workgroup: 'w',
    }) as Record<string, string>,
)

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn(() => useParams()),
    Redirect: vi.fn(() => null),
  }
})

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
  it('throw error when no bucket', () => {
    vi.spyOn(console, 'error').mockImplementationOnce(vi.fn())
    useParams.mockImplementationOnce(() => ({}))
    const Component = () => {
      const state = Model.useState()
      return <>{JSON.stringify(state, null, 2)}</>
    }
    const tree = () =>
      render(
        <Model.Provider preferences={{}}>
          <Component />
        </Model.Provider>,
      )
    expect(tree).toThrow('`bucket` must be defined')
  })

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
        abort: vi.fn(),
      }
    })
    listQueryExecutions.mockImplementation((_x, cb) => {
      cb(undefined, { QueryExecutionIds: [] })
      return {
        abort: vi.fn(),
      }
    })
    listDataCatalogs.mockImplementation(() => ({
      promise: () => Promise.resolve({ DataCatalogsSummary: [] }),
    }))
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Model.Provider preferences={{}}>{children}</Model.Provider>
    )
    const { result, waitFor, unmount } = renderHook(() => Model.useState(), { wrapper })
    await act(async () => {
      await waitFor(() => typeof result.current.executions.data === 'object')
    })
    expect(result.current.workgroups.data).toMatchObject({ list: ['bar', 'foo', 'w'] })
    expect(result.current.workgroup.data).toBe('w')
    unmount()
  })
})
