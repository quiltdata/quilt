import type A from 'aws-sdk/clients/athena'
import { act, renderHook } from '@testing-library/react-hooks'

import Log from 'utils/Logging'

import * as Model from './utils'
import * as requests from './requests'

class AWSError extends Error {
  code: string

  constructor(code: string, message?: string) {
    super(message)
    this.code = code
  }
}

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

const getStorageKey = jest.fn((): string => '')
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

const batchGetNamedQuery = jest.fn()
const batchGetQueryExecution = jest.fn()
const getDataCatalog = jest.fn()
const getQueryExecution = jest.fn()
const getQueryResults = jest.fn()
const getWorkGroup = jest.fn()
const listDataCatalogs = jest.fn()
const listDatabases = jest.fn()
const listNamedQueries = jest.fn()
const listQueryExecutions = jest.fn()
const listWorkGroups = jest.fn()
const startQueryExecution = jest.fn()

jest.mock('utils/AWS', () => ({
  Athena: {
    use: () => ({
      batchGetNamedQuery,
      batchGetQueryExecution,
      getDataCatalog,
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
    getDataCatalog.mockImplementation(
      reqThen<A.GetDataCatalogInput, A.GetDataCatalogOutput>(
        ({ Name }: { Name: string }) => ({
          DataCatalog: {
            Name,
            Type: 'any',
          },
        }),
      ),
    )
    it('return catalog names', async () => {
      listDataCatalogs.mockImplementation(
        reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
          DataCatalogsSummary: [{ CatalogName: 'foo' }, { CatalogName: 'bar' }],
        })),
      )
      const { result, waitForValueToChange } = renderHook(() =>
        requests.useCatalogNames('any'),
      )
      expect(result.current.data).toBe(undefined)

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ list: ['bar', 'foo'] })
    })

    it('return empty list', async () => {
      listDataCatalogs.mockImplementation(
        reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
          DataCatalogsSummary: [],
        })),
      )
      const { result, waitForValueToChange } = renderHook(() =>
        requests.useCatalogNames('any'),
      )

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ list: [] })
    })

    it('return empty list on invalid catalog data', async () => {
      listDataCatalogs.mockImplementation(
        reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
          // @ts-expect-error
          DataCatalogsSummary: [{ Nonsense: true }, { Absurd: false }],
        })),
      )
      const { result, waitForValueToChange } = renderHook(() =>
        requests.useCatalogNames('any'),
      )

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ list: [] })
    })

    it('return empty list on invalid list data', async () => {
      listDataCatalogs.mockImplementation(
        // @ts-expect-error
        reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
          Invalid: [],
        })),
      )
      const { result, waitForValueToChange } = renderHook(() =>
        requests.useCatalogNames('any'),
      )

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ list: [] })
    })

    it('doesnt return catalogs with denied access', async () => {
      listDataCatalogs.mockImplementation(
        reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
          DataCatalogsSummary: [{ CatalogName: 'foo' }, { CatalogName: 'bar' }],
        })),
      )
      getDataCatalog.mockImplementation(
        reqThrowWith(new AWSError('AccessDeniedException')),
      )
      const { result, waitForValueToChange } = renderHook(() =>
        requests.useCatalogNames('any'),
      )

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ list: [] })
    })

    it('doesnt return failed catalogs', async () => {
      listDataCatalogs.mockImplementation(
        reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
          DataCatalogsSummary: [{ CatalogName: 'foo' }, { CatalogName: 'bar' }],
        })),
      )
      getDataCatalog.mockImplementation(reqThrow)
      const { result, waitForValueToChange } = renderHook(() =>
        requests.useCatalogNames('any'),
      )

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ list: [] })
    })

    it('handle fail in requesting list', async () => {
      await act(async () => {
        listDataCatalogs.mockImplementation(reqThrow)
        const { result, unmount, waitFor } = renderHook(() =>
          requests.useCatalogNames('any'),
        )
        await waitFor(() => result.current.data instanceof Error)
        expect(Log.error).toBeCalledWith(expect.any(Error))
        expect(result.current.data).toBeInstanceOf(Error)
        unmount()
      })
    })

    function useWrapper(props: Parameters<typeof requests.useCatalogNames>) {
      return requests.useCatalogNames(...props)
    }

    it('wait until workgroup is ready', async () => {
      const { result, rerender, waitForValueToChange, unmount } = renderHook(
        (x: Parameters<typeof requests.useCatalogNames>) => useWrapper(x),
        { initialProps: [null] },
      )

      await act(async () => {
        rerender([Model.Loading])
        await waitForValueToChange(() => result.current)
      })
      expect(result.current.data).toBe(Model.Loading)

      const error = new Error('foo')
      await act(async () => {
        rerender([error])
        await waitForValueToChange(() => result.current)
      })
      expect(result.current.data).toBe(error)
      unmount()
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
      getStorageKey.mockImplementationOnce(() => 'bar')
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
          reqThrowWith(new AWSError('AccessDeniedException')),
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

    it('return "not ready" if database is not ready', async () => {
      startQueryExecution.mockImplementation(
        reqThen<A.StartQueryExecutionInput, A.StartQueryExecutionOutput>(() => ({})),
      )
      await act(async () => {
        const { result, unmount, waitForNextUpdate } = renderHook(() =>
          requests.useQueryRun({
            workgroup: 'a',
            catalogName: 'b',
            database: Model.Loading,
            queryBody: 'd',
          }),
        )
        await waitForNextUpdate()
        expect(result.current[0]).toBeUndefined()
        unmount()
      })
    })

    it('mark as ready to run but return error for confirmation if database is empty', async () => {
      startQueryExecution.mockImplementation(
        reqThen<A.StartQueryExecutionInput, A.StartQueryExecutionOutput>(() => ({})),
      )
      await act(async () => {
        const { result, unmount, waitForValueToChange } = renderHook(() =>
          requests.useQueryRun({
            workgroup: 'a',
            catalogName: 'b',
            database: '',
            queryBody: 'd',
          }),
        )
        await waitForValueToChange(() => result.current)
        await waitForValueToChange(() => result.current[0])
        expect(result.current[0]).toBeNull()
        const run = await result.current[1](false)
        expect(run).toBeInstanceOf(Error)
        expect(run).toBe(requests.NO_DATABASE)
        unmount()
      })
    })
  })

  describe('useWorkgroup', () => {
    function useWrapper(props: Parameters<typeof requests.useWorkgroup>) {
      return requests.useWorkgroup(...props)
    }

    it('select requested workgroup if it exists', async () => {
      await act(async () => {
        const workgroups = {
          data: { list: ['foo', 'bar'] },
          loadMore: jest.fn(),
        }
        const { result, waitFor } = renderHook(() =>
          useWrapper([workgroups, 'bar', undefined]),
        )
        await waitFor(() => typeof result.current.data === 'string')
        expect(result.current.data).toBe('bar')
      })
    })

    it('select initial workgroup from storage if valid', async () => {
      const storageMock = getStorageKey.getMockImplementation()
      getStorageKey.mockImplementation(() => 'bar')
      const workgroups = {
        data: { list: ['foo', 'bar'] },
        loadMore: jest.fn(),
      }

      const { result, waitFor, unmount } = renderHook(() =>
        useWrapper([workgroups, undefined, undefined]),
      )

      await act(async () => {
        await waitFor(() => typeof result.current.data === 'string')
        expect(result.current.data).toBe('bar')
      })
      getStorageKey.mockImplementation(storageMock)
      unmount()
    })

    it('select default workgroup from preferences if valid', async () => {
      const workgroups = {
        data: { list: ['foo', 'bar'] },
        loadMore: jest.fn(),
      }
      const preferences = { defaultWorkgroup: 'bar' }

      const { result, waitFor, unmount } = renderHook(() =>
        useWrapper([workgroups, undefined, preferences]),
      )

      await act(async () => {
        await waitFor(() => typeof result.current.data === 'string')
        expect(result.current.data).toBe('bar')
      })
      unmount()
    })

    it('select the first available workgroup if no requested or default', async () => {
      await act(async () => {
        const workgroups = {
          data: { list: ['foo', 'bar', 'baz'] },
          loadMore: jest.fn(),
        }

        const { result, waitFor } = renderHook(() =>
          useWrapper([workgroups, undefined, undefined]),
        )

        await waitFor(() => typeof result.current.data === 'string')
        expect(result.current.data).toBe('foo')
      })
    })

    it('return error if no workgroups are available', async () => {
      await act(async () => {
        const workgroups = {
          data: { list: [] },
          loadMore: jest.fn(),
        }

        const { result, waitFor } = renderHook(() =>
          useWrapper([workgroups, undefined, undefined]),
        )

        await waitFor(() => result.current.data instanceof Error)
        if (Model.isError(result.current.data)) {
          expect(result.current.data.message).toBe('Workgroup not found')
        } else {
          throw new Error('Not an error')
        }
      })
    })

    it('wait for workgroups', async () => {
      const workgroups = {
        data: undefined,
        loadMore: jest.fn(),
      }

      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useWorkgroup>) => useWrapper(x),
        { initialProps: [workgroups, undefined, undefined] },
      )
      expect(result.current.data).toBeUndefined()

      await act(async () => {
        rerender()
        await waitForNextUpdate()
      })
      expect(result.current.data).toBeUndefined()
      unmount()
    })
  })

  describe('useQuery', () => {
    function useWrapper(props: Parameters<typeof requests.useQuery>) {
      return requests.useQuery(...props)
    }

    it('sets query to the one matching the execution query', () => {
      const queries = {
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      }
      const execution = { query: 'SELECT * FROM bar' }
      const { result } = renderHook(() => useWrapper([queries, execution]))

      if (Model.hasData(result.current.value)) {
        expect(result.current.value.body).toBe('SELECT * FROM bar')
      } else {
        throw new Error('No data')
      }
    })

    it('unsets query if no matching execution query', () => {
      const queries = {
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      }
      const execution = { query: 'SELECT * FROM baz' }
      const { result } = renderHook(() => useWrapper([queries, execution]))

      if (Model.hasValue(result.current.value)) {
        expect(result.current.value).toBe(null)
      } else {
        throw new Error('No data')
      }
    })

    it('sets query to the first one if no execution query is set', () => {
      const queries = {
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      }
      const execution = {}
      const { result } = renderHook(() => useWrapper([queries, execution]))

      if (Model.hasData(result.current.value)) {
        expect(result.current.value.body).toBe('SELECT * FROM foo')
      } else {
        throw new Error('No data')
      }
    })

    it('sets query to null if no queries are available', () => {
      const queries = { list: [] }
      const execution = {}
      const { result } = renderHook(() => useWrapper([queries, execution]))

      if (Model.hasValue(result.current.value)) {
        expect(result.current.value).toBeNull()
      } else {
        throw new Error('No data')
      }
    })

    it('retains execution query when the list is changed', async () => {
      const queries = {
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      }
      const execution = {
        query: 'SELECT * FROM bar',
      }
      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQuery>) => useWrapper(props),
        {
          initialProps: [queries, execution],
        },
      )

      if (Model.hasData(result.current.value)) {
        expect(result.current.value.body).toBe('SELECT * FROM bar')
      } else {
        throw new Error('No data')
      }
      await act(async () => {
        rerender([
          {
            list: [
              { key: 'baz', name: 'Baz', body: 'SELECT * FROM baz' },
              ...queries.list,
            ],
          },
          execution,
        ])
        await waitForNextUpdate()
      })
      if (Model.hasData(result.current.value)) {
        expect(result.current.value.body).toBe('SELECT * FROM bar')
      } else {
        throw new Error('No data')
      }
    })

    it('does not change query when list is updated if a valid query is already selected', async () => {
      const queries = {
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      }
      const execution = null
      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQuery>) => useWrapper(props),
        {
          initialProps: [queries, execution],
        },
      )

      if (Model.hasData(result.current.value)) {
        expect(result.current.value.body).toBe('SELECT * FROM foo')
      } else {
        throw new Error('No data')
      }
      await act(async () => {
        rerender([
          {
            list: [
              { key: 'baz', name: 'Baz', body: 'SELECT * FROM baz' },
              ...queries.list,
            ],
          },
          execution,
        ])
        await waitForNextUpdate()
      })
      if (Model.hasData(result.current.value)) {
        expect(result.current.value.body).toBe('SELECT * FROM foo')
      } else {
        throw new Error('No data')
      }
    })

    it('returns selected (first) when execution is not ready', () => {
      const queries = {
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      }
      const execution = Model.Loading as Model.Value<requests.QueryExecution>
      const { result } = renderHook(() => useWrapper([queries, execution]))

      expect(result.current.value).toBe(queries.list[0])
    })
  })

  describe('useQueryBody', () => {
    function useWrapper(props: Parameters<typeof requests.useQueryBody>) {
      return requests.useQueryBody(...props)
    }

    it('sets query body from query if query is ready', () => {
      const query = { name: 'Foo', key: 'foo', body: 'SELECT * FROM foo' }
      const execution = null
      const setQuery = jest.fn()

      const { result } = renderHook(() => useWrapper([query, setQuery, execution]))

      if (Model.hasData(result.current.value)) {
        expect(result.current.value).toBe('SELECT * FROM foo')
      } else {
        throw new Error('No data')
      }
    })

    it('sets query body from execution if query is not selected', () => {
      const query = null
      const execution = { query: 'SELECT * FROM bar' }
      const setQuery = jest.fn()

      const { result } = renderHook(() => useWrapper([query, setQuery, execution]))

      if (Model.hasData(result.current.value)) {
        expect(result.current.value).toBe('SELECT * FROM bar')
      } else {
        throw new Error('No data')
      }
    })

    it('sets query body to null if query is an error', () => {
      const query = new Error('Query failed')
      const execution = {}
      const setQuery = jest.fn()

      const { result } = renderHook(() => useWrapper([query, setQuery, execution]))

      if (Model.hasValue(result.current.value)) {
        expect(result.current.value).toBeNull()
      } else {
        throw new Error('Unexpected state')
      }
    })

    it('does not change value if query and execution are both not ready', async () => {
      const query = undefined
      const execution = undefined
      const setQuery = jest.fn()

      const { result, rerender, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useQueryBody>) => useWrapper(x),
        {
          initialProps: [query, setQuery, execution],
        },
      )

      expect(result.current.value).toBeUndefined()
      // That's not possible from UI now,
      // but let's pretend UI is ready to handle user input
      act(() => {
        result.current.setValue('foo')
      })
      expect(result.current.value).toBe('foo')

      // We rerenderd hook but internal useEffect didn't rewrite the value
      // to `undefined` as it was supposed to do on the first render
      await act(async () => {
        rerender([query, setQuery, execution])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe('foo')
    })

    it('updates query body and resets query when handleValue is called', async () => {
      const query = { name: 'Foo', key: 'foo', body: 'SELECT * FROM foo' }
      const execution = {}
      const setQuery = jest.fn()

      const { result } = renderHook(() => useWrapper([query, setQuery, execution]))

      act(() => {
        result.current.setValue('SELECT * FROM bar')
      })

      expect(result.current.value).toBe('SELECT * FROM bar')
      expect(setQuery).toHaveBeenCalledWith(null)
    })

    it('obtains value when execution and query are initially empty but later update', async () => {
      const initialQuery = null
      const initialExecution = null
      const setQuery = jest.fn()

      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQueryBody>) => useWrapper(props),
        {
          initialProps: [initialQuery, setQuery, initialExecution],
        },
      )

      expect(result.current.value).toBeNull()

      // Query was loaded with some value
      // Execution is ready but it's still null
      await act(async () => {
        rerender([
          { key: 'up', name: 'Updated', body: 'SELECT * FROM updated' },
          setQuery,
          initialExecution,
        ])
        await waitForNextUpdate()
      })

      if (Model.hasData(result.current.value)) {
        expect(result.current.value).toBe('SELECT * FROM updated')
      } else {
        throw new Error('No data')
      }
    })

    it('sets query body to null if query is null after being loaded', async () => {
      const initialQuery = Model.Loading
      const initialExecution = null
      const setQuery = jest.fn()

      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQueryBody>) => useWrapper(props),
        {
          initialProps: [
            initialQuery as Model.Value<requests.Query>,
            setQuery,
            initialExecution,
          ],
        },
      )

      expect(result.current.value).toBe(Model.Loading)

      await act(async () => {
        rerender([null, setQuery, initialExecution])
        await waitForNextUpdate()
      })

      if (Model.hasValue(result.current.value)) {
        expect(result.current.value).toBeNull()
      } else {
        throw new Error('Unexpected state')
      }
    })

    it('retains value if selected query is null and we switch from some execution', async () => {
      // That's not ideal,
      // but we don't know what chanded the query body: execution page or user.
      // So, at least, it is documented here.
      const initialQuery = null
      const initialExecution = { id: 'any', query: 'SELECT * FROM updated' }
      const setQuery = jest.fn()

      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQueryBody>) => useWrapper(props),
        {
          initialProps: [
            initialQuery as Model.Value<requests.Query>,
            setQuery,
            initialExecution,
          ],
        },
      )

      expect(result.current.value).toBe('SELECT * FROM updated')

      await act(async () => {
        rerender([initialQuery, setQuery, null])
        await waitForNextUpdate()
      })

      if (Model.hasValue(result.current.value)) {
        expect(result.current.value).toBe('SELECT * FROM updated')
      } else {
        throw new Error('Unexpected state')
      }
    })
  })
})
