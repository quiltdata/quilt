import type A from 'aws-sdk/clients/athena'
import { act, renderHook } from '@testing-library/react-hooks'

import Log from 'utils/Logging'

import * as Model from './utils'
import * as requests from './requests'

jest.mock(
  'utils/Logging',
  jest.fn(() => ({
    error: jest.fn(),
    info: jest.fn(),
  })),
)

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

const getStorageKey = jest.fn((): string => 'value-from-storage')
jest.mock('utils/storage', () => () => ({
  get: jest.fn(() => getStorageKey()),
}))

function req<I, O>(output: O, delay = 100) {
  return jest.fn((_x: I, callback: (e: Error | null, d: O) => void) => {
    const timer = setTimeout(() => {
      callback(null, output)
    }, delay)
    return {
      abort: jest.fn(() => {
        clearTimeout(timer)
      }),
    }
  })
}

function reqThen<I, O>(output: (x: I) => O, delay = 100) {
  return jest.fn((x: I) => ({
    promise: () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(output(x))
        }, delay)
      }),
  }))
}

const reqThrow = jest.fn(() => ({
  promise: () => {
    throw new Error()
  },
}))

const reqThrowWith = (o: unknown) =>
  jest.fn(() => ({
    promise: () => {
      throw o
    },
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

jest.mock('utils/AWS', () => ({
  Athena: {
    use: () => ({
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
    }),
  },
}))

describe('containers/Bucket/Queries/Athena/model/requests', () => {
  describe('useCatalogNames', () => {
    it('return catalog names', async () => {
      listDataCatalogs.mockImplementationOnce(
        req<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>({
          DataCatalogsSummary: [{ CatalogName: 'foo' }, { CatalogName: 'bar' }],
        }),
      )
      const { result, waitForNextUpdate } = renderHook(() => requests.useCatalogNames())
      expect(result.current.data).toBe(undefined)

      await act(async () => {
        await waitForNextUpdate()
      })
      expect(result.current.data).toMatchObject({ list: ['foo', 'bar'] })
    })

    it('return empty list', async () => {
      listDataCatalogs.mockImplementationOnce(
        req<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>({
          DataCatalogsSummary: [],
        }),
      )
      const { result, waitForNextUpdate } = renderHook(() => requests.useCatalogNames())

      await act(async () => {
        await waitForNextUpdate()
      })
      expect(result.current.data).toMatchObject({ list: [] })
    })

    it('return unknowns on invalid data', async () => {
      listDataCatalogs.mockImplementationOnce(
        req<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>({
          // @ts-expect-error
          DataCatalogsSummary: [{ Nonsense: true }, { Absurd: false }],
        }),
      )
      const { result, waitForNextUpdate } = renderHook(() => requests.useCatalogNames())

      await act(async () => {
        await waitForNextUpdate()
      })
      expect(result.current.data).toMatchObject({ list: ['Unknown', 'Unknown'] })
    })

    it('return empty list on invalid data', async () => {
      listDataCatalogs.mockImplementationOnce(
        req<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>({
          // @ts-expect-error
          Invalid: [],
        }),
      )
      const { result, waitForNextUpdate } = renderHook(() => requests.useCatalogNames())

      await act(async () => {
        await waitForNextUpdate()
      })
      expect(result.current.data).toMatchObject({ list: [] })
    })
  })

  describe('useCatalogName', () => {
    // hooks doesn't support multiple arguments
    // https://github.com/testing-library/react-testing-library/issues/1350
    function useWrapper(props: Parameters<typeof requests.useCatalogName>) {
      return requests.useCatalogName(...props)
    }

    it('wait for catalog names list', async () => {
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [undefined, null] },
      )
      expect(result.current.value).toBe(undefined)

      const error = new Error('Fail')
      await act(async () => {
        rerender([error, null])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(error)

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, null])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('foo')
      unmount()
    })

    it('switch catalog when execution query loaded', async () => {
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [undefined, undefined] },
      )
      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, undefined])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('foo')
      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, { catalog: 'bar' }])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('bar')
      unmount()
    })

    it('select execution catalog when catalog list loaded after execution', async () => {
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [undefined, undefined] },
      )

      await act(async () => {
        rerender([Model.Loading, { catalog: 'bar' }])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(Model.Loading)

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, { catalog: 'bar' }])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('bar')

      unmount()
    })

    it('keep selection when execution has catalog that doesnt exist', async () => {
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [undefined, undefined] },
      )

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, undefined])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('foo')

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, { catalog: 'baz' }])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('foo')

      unmount()
    })

    it('select null when catalog doesnt exist', async () => {
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [undefined, undefined] },
      )

      await act(async () => {
        rerender([{ list: [] }, undefined])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(null)

      act(() => {
        result.current.setValue('baz')
      })
      expect(result.current.value).toBe('baz')

      unmount()
    })

    it('select initial catalog from local storage', async () => {
      getStorageKey.mockImplementationOnce(() => 'catalog-bar')
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [undefined, undefined] },
      )

      await act(async () => {
        rerender([{ list: ['foo', 'catalog-bar'] }, null])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('catalog-bar')

      unmount()
    })
  })

  describe('useDatabases', () => {
    it('wait for catalogName', async () => {
      const { result, rerender, waitForNextUpdate } = renderHook(
        (...c: Parameters<typeof requests.useDatabases>) => requests.useDatabases(...c),
        {
          initialProps: undefined,
        },
      )

      await act(async () => {
        rerender(Model.Loading)
        await waitForNextUpdate()
      })
      expect(result.current.data).toBe(Model.Loading)

      const error = new Error('foo')
      await act(async () => {
        rerender(error)
        await waitForNextUpdate()
      })
      expect(result.current.data).toBe(error)
    })

    it('return databases', async () => {
      listDatabases.mockImplementation(
        req<A.ListDatabasesInput, A.ListDatabasesOutput>({
          DatabaseList: [{ Name: 'bar' }, { Name: 'baz' }],
        }),
      )
      const { result, waitFor } = renderHook(() => requests.useDatabases('foo'))

      expect((result.all[0] as Model.DataController<any>).data).toBe(undefined)
      expect((result.all[1] as Model.DataController<any>).data).toBe(Model.Loading)
      await waitFor(() =>
        expect(result.current.data).toMatchObject({ list: ['bar', 'baz'] }),
      )
    })

    it('handle invalid database', async () => {
      listDatabases.mockImplementation(
        req<A.ListDatabasesInput, A.ListDatabasesOutput>({
          // @ts-expect-error
          DatabaseList: [{ A: 'B' }, { C: 'D' }],
        }),
      )
      const { result, waitFor } = renderHook(() => requests.useDatabases('foo'))
      await waitFor(() =>
        expect(result.current.data).toMatchObject({ list: ['Unknown', 'Unknown'] }),
      )
    })

    it('handle invalid list', async () => {
      listDatabases.mockImplementation(
        req<A.ListDatabasesInput, A.ListDatabasesOutput>({
          // @ts-expect-error
          Foo: 'Bar',
        }),
      )
      const { result, waitFor } = renderHook(() => requests.useDatabases('foo'))
      await waitFor(() => expect(result.current.data).toMatchObject({ list: [] }))
    })
  })

  describe('useDatabase', () => {
    function useWrapper(props: Parameters<typeof requests.useDatabase>) {
      return requests.useDatabase(...props)
    }

    it('wait for databases', async () => {
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [undefined, null] },
      )
      expect(result.current.value).toBe(undefined)

      await act(async () => {
        rerender([Model.Loading, null])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(Model.Loading)

      const error = new Error('Fail')
      await act(async () => {
        rerender([error, null])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(error)

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, null])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('foo')

      unmount()
    })

    it('switch database when execution query loaded', async () => {
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [undefined, undefined] },
      )

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, undefined])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('foo')

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, { db: 'bar' }])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('bar')

      unmount()
    })

    it('select execution db when databases loaded after execution', async () => {
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [undefined, undefined] },
      )

      await act(async () => {
        rerender([Model.Loading, { db: 'bar' }])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(Model.Loading)

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, { db: 'bar' }])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('bar')

      unmount()
    })

    it('keep selection when execution has db that doesn’t exist', async () => {
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [undefined, undefined] },
      )

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, undefined])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('foo')

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, { db: 'baz' }])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('foo')

      unmount()
    })

    it('select null when db doesn’t exist', async () => {
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [undefined, undefined] },
      )

      await act(async () => {
        rerender([{ list: [] }, undefined])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(null)

      act(() => {
        result.current.setValue('baz')
      })
      expect(result.current.value).toBe('baz')

      unmount()
    })

    it('select initial db from local storage', async () => {
      getStorageKey.mockImplementation(() => 'bar')
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [undefined, undefined] },
      )

      await act(async () => {
        rerender([{ list: ['foo', 'bar'] }, null])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('bar')

      unmount()
    })
  })

  describe('useWorkgroups', () => {
    listWorkGroups.mockImplementation(
      reqThen<A.ListWorkGroupsInput, A.ListWorkGroupsOutput>(() => ({
        WorkGroups: [{ Name: 'foo' }, { Name: 'bar' }],
      })),
    )

    it('return workgroups', async () => {
      await act(async () => {
        getWorkGroup.mockImplementation(
          reqThen<A.GetWorkGroupInput, A.GetWorkGroupOutput>(({ WorkGroup: Name }) => ({
            WorkGroup: {
              Configuration: {
                ResultConfiguration: {
                  OutputLocation: 'any',
                },
              },
              State: 'ENABLED',
              Name,
            },
          })),
        )
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() =>
          expect(result.current.data).toMatchObject({ list: ['bar', 'foo'] }),
        )
        unmount()
      })
    })

    it('return only valid workgroups', async () => {
      await act(async () => {
        getWorkGroup.mockImplementation(
          reqThen<A.GetWorkGroupInput, A.GetWorkGroupOutput>(({ WorkGroup: Name }) => ({
            WorkGroup: {
              Configuration: {
                ResultConfiguration: {
                  OutputLocation: 'any',
                },
              },
              State: Name === 'foo' ? 'DISABLED' : 'ENABLED',
              Name,
            },
          })),
        )
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => expect(result.current.data).toMatchObject({ list: ['bar'] }))
        unmount()
      })
    })

    it('handle invalid workgroup', async () => {
      await act(async () => {
        getWorkGroup.mockImplementation(
          // @ts-expect-error
          reqThen<A.GetWorkGroupInput, A.GetWorkGroupOutput>(() => ({
            Invalid: 'foo',
          })),
        )
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => typeof result.current.data === 'object')
        expect(result.current.data).toMatchObject({ list: [] })
        unmount()
      })
    })

    it('handle fail in workgroup', async () => {
      await act(async () => {
        getWorkGroup.mockImplementation(reqThrow)
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => typeof result.current.data === 'object')
        expect(Log.error).toBeCalledWith(
          'Fetching "bar" workgroup failed:',
          expect.any(Error),
        )
        expect(Log.error).toBeCalledWith(
          'Fetching "foo" workgroup failed:',
          expect.any(Error),
        )
        expect(result.current.data).toMatchObject({ list: [] })
        unmount()
      })
    })

    it('handle access denied for workgroup list', async () => {
      await act(async () => {
        getWorkGroup.mockImplementation(
          reqThrowWith({
            code: 'AccessDeniedException',
          }),
        )
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => typeof result.current.data === 'object')
        expect(Log.info).toBeCalledWith(
          'Fetching "bar" workgroup failed: AccessDeniedException',
        )
        expect(Log.info).toBeCalledWith(
          'Fetching "foo" workgroup failed: AccessDeniedException',
        )
        expect(result.current.data).toMatchObject({ list: [] })
        unmount()
      })
    })

    it('handle invalid list', async () => {
      await act(async () => {
        listWorkGroups.mockImplementation(
          // @ts-expect-error
          reqThen<A.ListWorkGroupsInput, A.ListWorkGroupsOutput>(() => ({
            Invalid: [{ Name: 'foo' }, { Name: 'bar' }],
          })),
        )
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => typeof result.current.data === 'object')
        expect(result.current.data).toMatchObject({ list: [] })
        unmount()
      })
    })

    it('handle no data in list', async () => {
      await act(async () => {
        listWorkGroups.mockImplementation(
          // @ts-expect-error
          reqThen<A.ListWorkGroupsInput, A.ListWorkGroupsOutput>(() => null),
        )
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => result.current.data instanceof Error)
        expect(Log.error).toBeCalledWith(
          new TypeError(`Cannot read properties of null (reading 'WorkGroups')`),
        )
        expect(result.current.data).toBeInstanceOf(TypeError)
        unmount()
      })
    })

    it('handle fail in list', async () => {
      await act(async () => {
        listWorkGroups.mockImplementation(reqThrow)
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => result.current.data instanceof Error)
        expect(Log.error).toBeCalledWith(expect.any(Error))
        expect(result.current.data).toBeInstanceOf(Error)
        unmount()
      })
    })
  })

  describe('useExecutions', () => {
    listQueryExecutions.mockImplementation(
      req<A.ListQueryExecutionsInput, A.ListQueryExecutionsOutput>({
        QueryExecutionIds: ['foo', 'bar'],
      }),
    )
    it('return results', async () => {
      batchGetQueryExecution.mockImplementation(
        req<A.BatchGetQueryExecutionInput, A.BatchGetQueryExecutionOutput>({
          QueryExecutions: [
            {
              QueryExecutionId: '$foo',
            },
            {
              QueryExecutionId: '$bar',
            },
          ],
          UnprocessedQueryExecutionIds: [
            { QueryExecutionId: '$baz', ErrorMessage: 'fail' },
          ],
        }),
      )
      await act(async () => {
        const { result, unmount, waitFor } = renderHook(() =>
          requests.useExecutions('any'),
        )
        await waitFor(() => typeof result.current.data === 'object')
        expect(result.current.data).toMatchObject({
          list: [
            { id: '$foo' },
            { id: '$bar' },
            { id: '$baz', error: new Error('fail') },
          ],
        })
        unmount()
      })
    })
  })

  describe('useWaitForQueryExecution', () => {
    it('return execution', async () => {
      getQueryExecution.mockImplementation(
        req<A.GetQueryExecutionInput, A.GetQueryExecutionOutput>({
          QueryExecution: { QueryExecutionId: '$foo', Status: { State: 'SUCCEEDED' } },
        }),
      )
      await act(async () => {
        const { result, unmount, waitFor } = renderHook(() =>
          requests.useWaitForQueryExecution('any'),
        )
        await waitFor(() => typeof result.current === 'object')
        expect(result.current).toMatchObject({
          id: '$foo',
        })
        unmount()
      })
    })
  })

  describe('useQueries', () => {
    listNamedQueries.mockImplementation(
      req<A.ListNamedQueriesInput, A.ListNamedQueriesOutput>({
        NamedQueryIds: ['foo', 'bar'],
      }),
    )
    it('return results', async () => {
      batchGetNamedQuery.mockImplementation(
        req<A.BatchGetNamedQueryInput, A.BatchGetNamedQueryOutput>({
          NamedQueries: [
            {
              Database: 'any',
              QueryString: 'SELECT * FROM *',
              NamedQueryId: '$foo',
              Name: 'Foo',
            },
            {
              Database: 'any',
              QueryString: 'SELECT * FROM *',
              NamedQueryId: '$bar',
              Name: 'Bar',
            },
          ],
        }),
      )
      await act(async () => {
        const { result, unmount, waitFor } = renderHook(() => requests.useQueries('any'))
        await waitFor(() => typeof result.current.data === 'object')
        expect(result.current.data).toMatchObject({
          list: [
            { name: 'Bar', key: '$bar', body: 'SELECT * FROM *' },
            { name: 'Foo', key: '$foo', body: 'SELECT * FROM *' },
          ],
        })
        unmount()
      })
    })
  })

  describe('useResults', () => {
    it('handle empty results', async () => {
      getQueryResults.mockImplementation(
        req<A.GetQueryResultsInput, A.GetQueryResultsOutput>({
          ResultSet: {
            Rows: [],
            ResultSetMetadata: {
              ColumnInfo: [{ Name: 'any', Type: 'some' }],
            },
          },
        }),
      )
      await act(async () => {
        const { result, unmount, waitFor } = renderHook(() =>
          requests.useResults({ id: 'any' }),
        )
        await waitFor(() => typeof result.current.data === 'object')
        expect(result.current.data).toMatchObject({
          rows: [],
          columns: [],
        })
        unmount()
      })
    })

    it('return results', async () => {
      getQueryResults.mockImplementation(
        req<A.GetQueryResultsInput, A.GetQueryResultsOutput>({
          ResultSet: {
            Rows: [
              {
                Data: [{ VarCharValue: 'foo' }, { VarCharValue: 'bar' }],
              },
              {
                Data: [{ VarCharValue: 'bar' }, { VarCharValue: 'baz' }],
              },
            ],
            ResultSetMetadata: {
              ColumnInfo: [
                { Name: 'foo', Type: 'some' },
                { Name: 'bar', Type: 'another' },
              ],
            },
          },
        }),
      )
      await act(async () => {
        const { result, unmount, waitFor } = renderHook(() =>
          requests.useResults({ id: 'any' }),
        )
        await waitFor(() => typeof result.current.data === 'object')
        expect(result.current.data).toMatchObject({
          rows: [['bar', 'baz']],
          columns: [
            { name: 'foo', type: 'some' },
            { name: 'bar', type: 'another' },
          ],
        })
        unmount()
      })
    })
  })

  describe('useQueryRun', () => {
    it('return execution id', async () => {
      startQueryExecution.mockImplementation(
        reqThen<A.StartQueryExecutionInput, A.StartQueryExecutionOutput>(() => ({
          QueryExecutionId: 'foo',
        })),
      )
      await act(async () => {
        const { result, unmount, waitForNextUpdate } = renderHook(() =>
          requests.useQueryRun({
            workgroup: 'a',
            catalogName: 'b',
            database: 'c',
            queryBody: 'd',
          }),
        )
        await waitForNextUpdate()
        const run = await result.current[1](false)
        expect(run).toMatchObject({
          id: 'foo',
        })
        unmount()
      })
    })

    it('return error if no execution id', async () => {
      startQueryExecution.mockImplementation(
        reqThen<A.StartQueryExecutionInput, A.StartQueryExecutionOutput>(() => ({})),
      )
      await act(async () => {
        const { result, unmount, waitForNextUpdate } = renderHook(() =>
          requests.useQueryRun({
            workgroup: 'a',
            catalogName: 'b',
            database: 'c',
            queryBody: 'd',
          }),
        )
        await waitForNextUpdate()
        const run = await result.current[1](false)
        expect(run).toBeInstanceOf(Error)
        expect(Log.error).toBeCalledWith(new Error('No execution id'))
        if (Model.isError(run)) {
          expect(run.message).toBe('No execution id')
        } else {
          throw new Error('queryRun is not an error')
        }
        unmount()
      })
    })

    it('handle fail in request', async () => {
      startQueryExecution.mockImplementation(reqThrow)
      await act(async () => {
        const { result, unmount, waitForNextUpdate } = renderHook(() =>
          requests.useQueryRun({
            workgroup: 'a',
            catalogName: 'b',
            database: 'c',
            queryBody: 'd',
          }),
        )
        await waitForNextUpdate()
        const run = await result.current[1](false)
        expect(run).toBeInstanceOf(Error)
        unmount()
      })
    })
  })
})
