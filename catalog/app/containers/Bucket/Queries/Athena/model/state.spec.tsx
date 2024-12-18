import * as React from 'react'
import renderer from 'react-test-renderer'
import { act, renderHook } from '@testing-library/react-hooks'

import * as Model from './'

jest.mock('utils/NamedRoutes', () => ({
  ...jest.requireActual('utils/NamedRoutes'),
  use: jest.fn(() => ({
    urls: {
      bucketAthenaExecution: () => 'bucket-route',
      bucketAthenaWorkgroup: () => 'workgroup-route',
    },
  })),
}))

const useParams = jest.fn(
  () =>
    ({
      bucket: 'b',
      workgroup: 'w',
    }) as Record<string, string>,
)

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(() => useParams()),
  Redirect: jest.fn(() => null),
}))

const batchGetQueryExecution = jest.fn()
const getWorkGroup = jest.fn()
const listDataCatalogs = jest.fn()
const listDatabases = jest.fn()
const listQueryExecutions = jest.fn()
const listWorkGroups = jest.fn()
const getQueryExecution = jest.fn()
const listNamedQueries = jest.fn()
const batchGetNamedQuery = jest.fn()
const getQueryResults = jest.fn()
const startQueryExecution = jest.fn()

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

jest.mock('utils/AWS', () => ({ Athena: { use: () => AthenaApi } }))

describe('app/containers/Queries/Athena/model/state', () => {
  it('throw error when no bucket', () => {
    jest.spyOn(console, 'error').mockImplementationOnce(jest.fn())
    useParams.mockImplementationOnce(() => ({}))
    const Component = () => {
      const state = Model.useState()
      return <>{JSON.stringify(state, null, 2)}</>
    }
    const tree = () =>
      renderer.create(
        <Model.Provider preferences={{}}>
          <Component />
        </Model.Provider>,
      )
    expect(tree).toThrowError('`bucket` must be defined')
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
        abort: jest.fn(),
      }
    })
    listQueryExecutions.mockImplementation((_x, cb) => {
      cb(undefined, { QueryExecutionIds: [] })
      return {
        abort: jest.fn(),
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
