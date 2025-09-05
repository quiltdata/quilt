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
        requests.useCatalogNames(Model.Payload('any')),
      )
      expect(result.current.data).toBe(Model.Init)

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({
        _tag: 'data',
        data: { list: ['bar', 'foo'] },
      })
    })

    it('return empty list', async () => {
      listDataCatalogs.mockImplementation(
        reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
          DataCatalogsSummary: [],
        })),
      )
      const { result, waitForValueToChange } = renderHook(() =>
        requests.useCatalogNames(Model.Payload('any')),
      )

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ _tag: 'data', data: { list: [] } })
    })

    it('return empty list on invalid catalog data', async () => {
      listDataCatalogs.mockImplementation(
        reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
          // @ts-expect-error
          DataCatalogsSummary: [{ Nonsense: true }, { Absurd: false }],
        })),
      )
      const { result, waitForValueToChange } = renderHook(() =>
        requests.useCatalogNames(Model.Payload('any')),
      )

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ _tag: 'data', data: { list: [] } })
    })

    it('return empty list on invalid list data', async () => {
      listDataCatalogs.mockImplementation(
        // @ts-expect-error
        reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
          Invalid: [],
        })),
      )
      const { result, waitForValueToChange } = renderHook(() =>
        requests.useCatalogNames(Model.Payload('any')),
      )

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ _tag: 'data', data: { list: [] } })
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
        requests.useCatalogNames(Model.Payload('any')),
      )

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ _tag: 'data', data: { list: [] } })
    })

    it('doesnt return failed catalogs', async () => {
      listDataCatalogs.mockImplementation(
        reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
          DataCatalogsSummary: [{ CatalogName: 'foo' }, { CatalogName: 'bar' }],
        })),
      )
      getDataCatalog.mockImplementation(reqThrow)
      const { result, waitForValueToChange } = renderHook(() =>
        requests.useCatalogNames(Model.Payload('any')),
      )

      await waitForValueToChange(() => result.current)
      expect(result.current.data).toMatchObject({ _tag: 'data', data: { list: [] } })
    })

    it('handle fail in requesting list', async () => {
      await act(async () => {
        listDataCatalogs.mockImplementation(reqThrow)
        const { result, unmount, waitFor } = renderHook(() =>
          requests.useCatalogNames(Model.Payload('any')),
        )
        await waitFor(() => Model.isError(result.current.data))
        expect(Log.error).toHaveBeenCalledWith(expect.any(Error))
        expect(Model.isError(result.current.data)).toBe(true)
        unmount()
      })
    })

    function useWrapper(props: Parameters<typeof requests.useCatalogNames>) {
      return requests.useCatalogNames(...props)
    }

    it('wait until workgroup is ready', async () => {
      const { result, rerender, waitForValueToChange, unmount } = renderHook(
        (x: Parameters<typeof requests.useCatalogNames>) => useWrapper(x),
        { initialProps: [Model.None] },
      )

      await act(async () => {
        rerender([Model.Pending])
        await waitForValueToChange(() => result.current)
      })
      expect(result.current.data).toBe(Model.Pending)

      const error = new Error('foo')
      const errState = Model.Err(error)
      await act(async () => {
        rerender([errState])
        await waitForValueToChange(() => result.current)
      })
      expect(result.current.data).toBe(errState)
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
        { initialProps: [Model.Init, Model.None] },
      )
      expect(result.current.value).toBe(Model.Init)

      const error = new Error('Fail')
      const errState = Model.Err(error)
      await act(async () => {
        rerender([errState, Model.None])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(errState)

      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'bar'] }), Model.None])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'foo' })
      unmount()
    })

    it('switch catalog when execution query loaded', async () => {
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [Model.Init, Model.Init] },
      )
      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'bar'] }), Model.Init])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'foo' })
      await act(async () => {
        rerender([
          Model.Payload({ list: ['foo', 'bar'] }),
          Model.Payload({ catalog: 'bar' }),
        ])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'bar' })
      unmount()
    })

    it('select execution catalog when catalog list loaded after execution', async () => {
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [Model.Init, Model.Init] },
      )

      await act(async () => {
        rerender([Model.Pending, Model.Payload({ catalog: 'bar' })])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(Model.Pending)

      await act(async () => {
        rerender([
          Model.Payload({ list: ['foo', 'bar'] }),
          Model.Payload({ catalog: 'bar' }),
        ])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'bar' })

      unmount()
    })

    it('keep selection when execution has catalog that doesnt exist', async () => {
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [Model.Init, Model.Init] },
      )

      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'bar'] }), Model.Init])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'foo' })

      await act(async () => {
        rerender([
          Model.Payload({ list: ['foo', 'bar'] }),
          Model.Payload({ catalog: 'baz' }),
        ])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'foo' })

      unmount()
    })

    it('select none when catalog doesnt exist', async () => {
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [Model.Init, Model.Init] },
      )

      await act(async () => {
        rerender([Model.Payload({ list: [] }), Model.Init])
        await waitForNextUpdate()
      })
      expect(Model.isNone(result.current.value)).toBe(true)

      act(() => {
        result.current.setValue('baz')
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'baz' })

      unmount()
    })

    it('select initial catalog from local storage', async () => {
      getStorageKey.mockImplementationOnce(() => 'catalog-bar')
      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useCatalogName>) => useWrapper(x),
        { initialProps: [Model.Init, Model.Init] },
      )

      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'catalog-bar'] }), Model.None])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'catalog-bar' })

      unmount()
    })
  })

  describe('useDatabases', () => {
    it('wait for catalogName', async () => {
      const { result, rerender, waitForNextUpdate } = renderHook(
        (...c: Parameters<typeof requests.useDatabases>) => requests.useDatabases(...c),
        {
          initialProps: Model.Init as Model.Value<string>,
        },
      )

      await act(async () => {
        rerender(Model.Pending)
        await waitForNextUpdate()
      })
      expect(result.current.data).toBe(Model.Pending)

      const error = new Error('foo')
      const errState = Model.Err(error)
      await act(async () => {
        rerender(errState)
        await waitForNextUpdate()
      })
      expect(result.current.data).toBe(errState)
    })

    it('return databases', async () => {
      listDatabases.mockImplementation(
        req<A.ListDatabasesInput, A.ListDatabasesOutput>({
          DatabaseList: [{ Name: 'bar' }, { Name: 'baz' }],
        }),
      )
      const { result, waitFor } = renderHook(() =>
        requests.useDatabases(Model.Payload('foo')),
      )

      expect((result.all[0] as Model.DataController<any>).data).toBe(Model.Init)
      expect((result.all[1] as Model.DataController<any>).data).toBe(Model.Pending)
      await waitFor(() =>
        expect(result.current.data).toMatchObject({
          _tag: 'data',
          data: { list: ['bar', 'baz'] },
        }),
      )
    })

    it('handle invalid database', async () => {
      listDatabases.mockImplementation(
        req<A.ListDatabasesInput, A.ListDatabasesOutput>({
          // @ts-expect-error
          DatabaseList: [{ A: 'B' }, { C: 'D' }],
        }),
      )
      const { result, waitFor } = renderHook(() =>
        requests.useDatabases(Model.Payload('foo')),
      )
      await waitFor(() =>
        expect(result.current.data).toMatchObject({
          _tag: 'data',
          data: { list: ['Unknown', 'Unknown'] },
        }),
      )
    })

    it('handle invalid list', async () => {
      listDatabases.mockImplementation(
        req<A.ListDatabasesInput, A.ListDatabasesOutput>({
          // @ts-expect-error
          Foo: 'Bar',
        }),
      )
      const { result, waitFor } = renderHook(() =>
        requests.useDatabases(Model.Payload('foo')),
      )
      await waitFor(() =>
        expect(result.current.data).toMatchObject({ _tag: 'data', data: { list: [] } }),
      )
    })
  })

  describe('useDatabase', () => {
    function useWrapper(props: Parameters<typeof requests.useDatabase>) {
      return requests.useDatabase(...props)
    }

    it('wait for databases', async () => {
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [Model.Init, Model.None] },
      )
      expect(result.current.value).toBe(Model.Init)

      await act(async () => {
        rerender([Model.Pending, Model.None])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(Model.Pending)

      const error = new Error('Fail')
      const errState = Model.Err(error)
      await act(async () => {
        rerender([errState, Model.None])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(errState)

      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'bar'] }), Model.None])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'foo' })

      unmount()
    })

    it('switch database when execution query loaded', async () => {
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [Model.Init, Model.Init] },
      )

      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'bar'] }), Model.Init])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'foo' })

      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'bar'] }), Model.Payload({ db: 'bar' })])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'bar' })

      unmount()
    })

    it('select execution db when databases loaded after execution', async () => {
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [Model.Init, Model.Init] },
      )

      await act(async () => {
        rerender([Model.Pending, Model.Payload({ db: 'bar' })])
        await waitForNextUpdate()
      })
      expect(result.current.value).toBe(Model.Pending)

      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'bar'] }), Model.Payload({ db: 'bar' })])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'bar' })

      unmount()
    })

    it('keep selection when execution has db that doesn’t exist', async () => {
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [Model.Init, Model.Init] },
      )

      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'bar'] }), Model.Init])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'foo' })

      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'bar'] }), Model.Payload({ db: 'baz' })])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'foo' })

      unmount()
    })

    it('select none when db does not exist', async () => {
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [Model.Init, Model.Init] },
      )

      await act(async () => {
        rerender([Model.Payload({ list: [] }), Model.Init])
        await waitForNextUpdate()
      })
      expect(Model.isNone(result.current.value)).toBe(true)

      act(() => {
        result.current.setValue('baz')
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'baz' })

      unmount()
    })

    it('select initial db from local storage', async () => {
      getStorageKey.mockImplementationOnce(() => 'bar')
      const { result, rerender, waitForNextUpdate, unmount } = renderHook(
        (x: Parameters<typeof requests.useDatabase>) => useWrapper(x),
        { initialProps: [Model.Init, Model.Init] },
      )

      await act(async () => {
        rerender([Model.Payload({ list: ['foo', 'bar'] }), Model.None])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'bar' })

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
          expect(result.current.data).toMatchObject({
            _tag: 'data',
            data: { list: ['bar', 'foo'] },
          }),
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
        await waitFor(() =>
          expect(result.current.data).toMatchObject({
            _tag: 'data',
            data: { list: ['bar'] },
          }),
        )
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
        await waitFor(() => Model.hasData(result.current.data))
        expect(result.current.data).toMatchObject({ _tag: 'data', data: { list: [] } })
        unmount()
      })
    })

    it('handle fail in workgroup', async () => {
      await act(async () => {
        getWorkGroup.mockImplementation(reqThrow)
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => Model.hasData(result.current.data))
        expect(Log.error).toHaveBeenCalledWith(
          'Fetching "bar" workgroup failed:',
          expect.any(Error),
        )
        expect(Log.error).toHaveBeenCalledWith(
          'Fetching "foo" workgroup failed:',
          expect.any(Error),
        )
        expect(result.current.data).toMatchObject({ _tag: 'data', data: { list: [] } })
        unmount()
      })
    })

    it('handle access denied for workgroup list', async () => {
      await act(async () => {
        getWorkGroup.mockImplementation(
          reqThrowWith(new AWSError('AccessDeniedException')),
        )
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => Model.hasData(result.current.data))
        expect(Log.info).toHaveBeenCalledWith(
          'Fetching "bar" workgroup failed: AccessDeniedException',
        )
        expect(Log.info).toHaveBeenCalledWith(
          'Fetching "foo" workgroup failed: AccessDeniedException',
        )
        expect(result.current.data).toMatchObject({ _tag: 'data', data: { list: [] } })
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
        await waitFor(() => Model.hasData(result.current.data))
        expect(result.current.data).toMatchObject({ _tag: 'data', data: { list: [] } })
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
        await waitFor(() => Model.isError(result.current.data))
        expect(Log.error).toHaveBeenCalledWith(
          new TypeError(`Cannot read properties of null (reading 'WorkGroups')`),
        )
        expect(Model.isError(result.current.data)).toBe(true)
        unmount()
      })
    })

    it('handle fail in list', async () => {
      await act(async () => {
        listWorkGroups.mockImplementation(reqThrow)
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => Model.isError(result.current.data))
        expect(Log.error).toHaveBeenCalledWith(expect.any(Error))
        expect(Model.isError(result.current.data)).toBe(true)
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
          requests.useExecutions(Model.Payload('any')),
        )
        await waitFor(() => Model.hasData(result.current.data))
        expect(result.current.data).toMatchObject({
          _tag: 'data',
          data: {
            list: [
              { id: '$foo' },
              { id: '$bar' },
              { id: '$baz', error: new Error('fail') },
            ],
          },
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
        await waitFor(() => Model.hasData(result.current) && !!result.current.data.id)
        expect(result.current).toMatchObject({
          _tag: 'data',
          data: { id: '$foo' },
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
        const { result, unmount, waitFor } = renderHook(() =>
          requests.useQueries(Model.Payload('any')),
        )
        await waitFor(() => Model.hasData(result.current.data))
        expect(result.current.data).toMatchObject({
          _tag: 'data',
          data: {
            list: [
              { name: 'Bar', key: '$bar', body: 'SELECT * FROM *' },
              { name: 'Foo', key: '$foo', body: 'SELECT * FROM *' },
            ],
          },
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
          requests.useResults(Model.Payload({ id: 'any' })),
        )
        await waitFor(() => Model.hasData(result.current.data))
        expect(result.current.data).toMatchObject({
          _tag: 'data',
          data: {
            rows: [],
            columns: [],
          },
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
          requests.useResults(Model.Payload({ id: 'any' })),
        )
        await waitFor(() => Model.hasData(result.current.data))
        expect(result.current.data).toMatchObject({
          _tag: 'data',
          data: {
            rows: [['bar', 'baz']],
            columns: [
              { name: 'foo', type: 'some' },
              { name: 'bar', type: 'another' },
            ],
          },
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
            workgroup: Model.Payload('a'),
            catalogName: Model.Payload('b'),
            database: Model.Payload('c'),
            queryBody: Model.Payload('d'),
          }),
        )
        await waitForNextUpdate()
        const run = await result.current[1](false)
        expect(run).toMatchObject({
          _tag: 'data',
          data: { id: 'foo' },
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
            workgroup: Model.Payload('a'),
            catalogName: Model.Payload('b'),
            database: Model.Payload('c'),
            queryBody: Model.Payload('d'),
          }),
        )
        await waitForNextUpdate()
        const run = await result.current[1](false)
        expect(Model.isError(run)).toBe(true)
        expect(Log.error).toHaveBeenCalledWith(new Error('No execution id'))
        if (Model.isError(run)) {
          expect(run.error.message).toBe('No execution id')
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
            workgroup: Model.Payload('a'),
            catalogName: Model.Payload('b'),
            database: Model.Payload('c'),
            queryBody: Model.Payload('d'),
          }),
        )
        await waitForNextUpdate()
        const run = await result.current[1](false)
        expect(Model.isError(run)).toBe(true)
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
            workgroup: Model.Payload('a'),
            catalogName: Model.Payload('b'),
            database: Model.Pending,
            queryBody: Model.Payload('d'),
          }),
        )
        await waitForNextUpdate()
        expect(result.current[0]._tag).toBe('init')
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
            workgroup: Model.Payload('a'),
            catalogName: Model.Payload('b'),
            database: Model.None,
            queryBody: Model.Payload('d'),
          }),
        )
        await waitForValueToChange(() => result.current)
        await waitForValueToChange(() => result.current[0])
        expect(Model.isNone(result.current[0])).toBe(true)
        const run = await result.current[1](false)
        expect(Model.isError(run)).toBe(true)
        if (Model.isError(run)) {
          expect(run.error.message).toBe('No database')
        }
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
          data: Model.Payload({ list: ['foo', 'bar'] }),
          loadMore: jest.fn(),
        }
        const { result, waitFor } = renderHook(() =>
          useWrapper([workgroups, 'bar', undefined]),
        )
        await waitFor(() => Model.hasData(result.current))
        expect(result.current).toMatchObject({ _tag: 'data', data: 'bar' })
      })
    })

    it('select initial workgroup from storage if valid', async () => {
      const storageMock = getStorageKey.getMockImplementation()
      getStorageKey.mockImplementation(() => 'bar')
      const workgroups = {
        data: Model.Payload({ list: ['foo', 'bar'] }),
        loadMore: jest.fn(),
      }

      const { result, waitFor, unmount } = renderHook(() =>
        useWrapper([workgroups, undefined, undefined]),
      )

      await act(async () => {
        await waitFor(() => Model.hasData(result.current))
        expect(result.current).toMatchObject({ _tag: 'data', data: 'bar' })
      })
      getStorageKey.mockImplementation(storageMock)
      unmount()
    })

    it('select default workgroup from preferences if valid', async () => {
      const workgroups = {
        data: Model.Payload({ list: ['foo', 'bar'] }),
        loadMore: jest.fn(),
      }
      const preferences = { defaultWorkgroup: 'bar' }

      const { result, waitFor, unmount } = renderHook(() =>
        useWrapper([workgroups, undefined, preferences]),
      )

      await act(async () => {
        await waitFor(() => Model.hasData(result.current))
        expect(result.current).toMatchObject({ _tag: 'data', data: 'bar' })
      })
      unmount()
    })

    it('select the first available workgroup if no requested or default', async () => {
      await act(async () => {
        const workgroups = {
          data: Model.Payload({ list: ['foo', 'bar', 'baz'] }),
          loadMore: jest.fn(),
        }

        const { result, waitFor } = renderHook(() =>
          useWrapper([workgroups, undefined, undefined]),
        )

        await waitFor(() => Model.hasData(result.current))
        expect(result.current).toMatchObject({ _tag: 'data', data: 'foo' })
      })
    })

    it('return error if no workgroups are available', async () => {
      await act(async () => {
        const workgroups = {
          data: Model.Payload({ list: [] }),
          loadMore: jest.fn(),
        }

        const { result, waitFor } = renderHook(() =>
          useWrapper([workgroups, undefined, undefined]),
        )

        await waitFor(() => Model.isError(result.current))
        if (Model.isError(result.current)) {
          expect(result.current.error.message).toBe('Workgroup not found')
        } else {
          throw new Error('Not an error')
        }
      })
    })

    it('wait for workgroups', async () => {
      const workgroups = {
        data: Model.Init,
        loadMore: jest.fn(),
      }

      const { result, rerender, unmount, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useWorkgroup>) => useWrapper(x),
        { initialProps: [workgroups, undefined, undefined] },
      )
      expect(result.current._tag).toBe('init')

      await act(async () => {
        rerender()
        await waitForNextUpdate()
      })
      expect(result.current._tag).toBe('init')
      unmount()
    })
  })

  describe('useQuery', () => {
    function useWrapper(props: Parameters<typeof requests.useQuery>) {
      return requests.useQuery(...props)
    }

    it('sets query to the one matching the execution query', () => {
      const queries = Model.Payload({
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      })
      const execution = Model.Payload({ query: 'SELECT * FROM bar' })
      const { result } = renderHook(() => useWrapper([queries, execution]))

      if (Model.hasData(result.current.value)) {
        expect(result.current.value.data.body).toBe('SELECT * FROM bar')
      } else {
        throw new Error('No data')
      }
    })

    it('unsets query if no matching execution query', () => {
      const queries = Model.Payload({
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      })
      const execution = Model.Payload({ query: 'SELECT * FROM baz' })
      const { result } = renderHook(() => useWrapper([queries, execution]))

      if (Model.hasValue(result.current.value)) {
        expect(Model.isNone(result.current.value)).toBe(true)
      } else {
        throw new Error('No data')
      }
    })

    it('sets query to the first one if no execution query is set', () => {
      const queries = Model.Payload({
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      })
      const execution = Model.Payload({})
      const { result } = renderHook(() => useWrapper([queries, execution]))

      if (Model.hasData(result.current.value)) {
        expect(result.current.value.data.body).toBe('SELECT * FROM foo')
      } else {
        throw new Error('No data')
      }
    })

    it('sets query to null if no queries are available', () => {
      const queries = Model.Payload({ list: [] })
      const execution = Model.Payload({})
      const { result } = renderHook(() => useWrapper([queries, execution]))

      if (Model.hasValue(result.current.value)) {
        expect(Model.isNone(result.current.value)).toBe(true)
      } else {
        throw new Error('No data')
      }
    })

    it('retains execution query when the list is changed', async () => {
      const queries = Model.Payload({
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      })
      const execution = Model.Payload({
        query: 'SELECT * FROM bar',
      })
      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQuery>) => useWrapper(props),
        {
          initialProps: [queries, execution],
        },
      )

      if (Model.hasData(result.current.value)) {
        expect(result.current.value.data.body).toBe('SELECT * FROM bar')
      } else {
        throw new Error('No data')
      }
      await act(async () => {
        rerender([
          Model.Payload({
            list: [
              { key: 'baz', name: 'Baz', body: 'SELECT * FROM baz' },
              ...queries.data.list,
            ],
          }),
          execution,
        ])
        await waitForNextUpdate()
      })
      if (Model.hasData(result.current.value)) {
        expect(result.current.value.data.body).toBe('SELECT * FROM bar')
      } else {
        throw new Error('No data')
      }
    })

    it('does not change query when list is updated if a valid query is already selected', async () => {
      const queries = Model.Payload({
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      })
      const execution = Model.None
      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQuery>) => useWrapper(props),
        {
          initialProps: [queries, execution],
        },
      )

      if (Model.hasData(result.current.value)) {
        expect(result.current.value.data.body).toBe('SELECT * FROM foo')
      } else {
        throw new Error('No data')
      }
      await act(async () => {
        rerender([
          Model.Payload({
            list: [
              { key: 'baz', name: 'Baz', body: 'SELECT * FROM baz' },
              ...queries.data.list,
            ],
          }),
          execution,
        ])
        await waitForNextUpdate()
      })
      if (Model.hasData(result.current.value)) {
        expect(result.current.value.data.body).toBe('SELECT * FROM foo')
      } else {
        throw new Error('No data')
      }
    })

    it('preserves current selection when execution becomes not ready', async () => {
      const queries = Model.Payload({
        list: [
          { key: 'foo', name: 'Foo', body: 'SELECT * FROM foo' },
          { key: 'bar', name: 'Bar', body: 'SELECT * FROM bar' },
        ],
      })

      // Initially execution is ready (null), so first query gets selected
      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQuery>) => useWrapper(props),
        {
          initialProps: [queries, Model.None],
        },
      )
      expect(result.current.value).toMatchObject({
        _tag: 'data',
        data: queries.data.list[0],
      })

      // Now execution becomes Loading - query should preserve current selection
      await act(async () => {
        rerender([queries, Model.Pending as Model.Value<requests.QueryExecution>])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({
        _tag: 'data',
        data: queries.data.list[0],
      })
    })
  })

  describe('useQueryBody', () => {
    function useWrapper(props: Parameters<typeof requests.useQueryBody>) {
      return requests.useQueryBody(...props)
    }

    it('sets query body from query if query is ready', () => {
      const query = Model.Payload({
        name: 'Foo',
        key: 'foo',
        body: 'SELECT * FROM foo',
      })
      const execution = Model.None
      const setQuery = jest.fn()

      const { result } = renderHook(() => useWrapper([query, setQuery, execution]))

      if (Model.hasData(result.current.value)) {
        expect(result.current.value).toMatchObject({
          _tag: 'data',
          data: 'SELECT * FROM foo',
        })
      } else {
        throw new Error('No data')
      }
    })

    it('sets query body from execution if query is not selected', () => {
      const query = Model.None
      const execution = Model.Payload({ query: 'SELECT * FROM bar' })
      const setQuery = jest.fn()

      const { result } = renderHook(() => useWrapper([query, setQuery, execution]))

      if (Model.hasData(result.current.value)) {
        expect(result.current.value).toMatchObject({
          _tag: 'data',
          data: 'SELECT * FROM bar',
        })
      } else {
        throw new Error('No data')
      }
    })

    it('sets query body to null if query is an error', () => {
      const query = Model.Err(new Error('Query failed'))
      const execution = Model.Payload({})
      const setQuery = jest.fn()

      const { result } = renderHook(() => useWrapper([query, setQuery, execution]))

      if (Model.hasValue(result.current.value)) {
        expect(Model.isNone(result.current.value)).toBe(true)
      } else {
        throw new Error('Unexpected state')
      }
    })

    it('does not change value if query and execution are both not ready', async () => {
      const query = Model.Init
      const execution = Model.Init
      const setQuery = jest.fn()

      const { result, rerender, waitForNextUpdate } = renderHook(
        (x: Parameters<typeof requests.useQueryBody>) => useWrapper(x),
        {
          initialProps: [query, setQuery, execution],
        },
      )

      expect(result.current.value._tag).toBe('init')
      // That's not possible from UI now,
      // but let's pretend UI is ready to handle user input
      act(() => {
        result.current.setValue('foo')
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'foo' })

      // We rerenderd hook but internal useEffect didn't rewrite the value
      // to `Model.Init` as it was supposed to do on the first render
      await act(async () => {
        rerender([query, setQuery, execution])
        await waitForNextUpdate()
      })
      expect(result.current.value).toMatchObject({ _tag: 'data', data: 'foo' })
    })

    it('updates query body and resets query when handleValue is called', async () => {
      const query = Model.Payload({
        name: 'Foo',
        key: 'foo',
        body: 'SELECT * FROM foo',
      })
      const execution = Model.Payload({})
      const setQuery = jest.fn()

      const { result } = renderHook(() => useWrapper([query, setQuery, execution]))

      act(() => {
        result.current.setValue('SELECT * FROM bar')
      })

      expect(result.current.value).toMatchObject({
        _tag: 'data',
        data: 'SELECT * FROM bar',
      })
      expect(setQuery).toHaveBeenCalled()
    })

    it('obtains value when execution and query are initially empty but later update', async () => {
      const initialQuery = Model.None
      const initialExecution = Model.None
      const setQuery = jest.fn()

      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQueryBody>) => useWrapper(props),
        {
          initialProps: [initialQuery, setQuery, initialExecution],
        },
      )

      expect(Model.isNone(result.current.value)).toBe(true)

      // Query was loaded with some value
      // Execution is ready but it's still null
      await act(async () => {
        rerender([
          Model.Payload({
            key: 'up',
            name: 'Updated',
            body: 'SELECT * FROM updated',
          }),
          setQuery,
          initialExecution,
        ])
        await waitForNextUpdate()
      })

      if (Model.hasData(result.current.value)) {
        expect(result.current.value).toMatchObject({
          _tag: 'data',
          data: 'SELECT * FROM updated',
        })
      } else {
        throw new Error('No data')
      }
    })

    it('sets query body to null if query is null after being loaded', async () => {
      const initialQuery = Model.Pending
      const initialExecution = Model.None
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

      expect(result.current.value).toBe(Model.Pending)

      await act(async () => {
        rerender([Model.None, setQuery, initialExecution])
        await waitForNextUpdate()
      })

      if (Model.hasValue(result.current.value)) {
        expect(Model.isNone(result.current.value)).toBe(true)
      } else {
        throw new Error('Unexpected state')
      }
    })

    it('retains value if selected query is null and we switch from some execution', async () => {
      // That's not ideal,
      // but we don't know what chanded the query body: execution page or user.
      // So, at least, it is documented here.
      const initialQuery = Model.None
      const initialExecution = Model.Payload({
        id: 'any',
        query: 'SELECT * FROM updated',
      })
      const setQuery = jest.fn()

      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQueryBody>) => useWrapper(props),
        {
          initialProps: [initialQuery, setQuery, initialExecution],
        },
      )

      expect(result.current.value).toMatchObject({
        _tag: 'data',
        data: 'SELECT * FROM updated',
      })

      await act(async () => {
        rerender([initialQuery, setQuery, Model.None])
        await waitForNextUpdate()
      })

      if (Model.hasValue(result.current.value)) {
        expect(result.current.value).toMatchObject({
          _tag: 'data',
          data: 'SELECT * FROM updated',
        })
      } else {
        throw new Error('Unexpected state')
      }
    })

    it('preserves user input during query submission loading', async () => {
      const query = { name: 'Foo', key: 'foo', body: 'SELECT * FROM foo' }
      const setQuery = jest.fn()

      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: Parameters<typeof requests.useQueryBody>) => useWrapper(props),
        {
          initialProps: [Model.Payload(query), setQuery, Model.None],
        },
      )
      // Initial state: queryBody is set from query.body
      expect(result.current.value).toMatchObject({
        _tag: 'data',
        data: 'SELECT * FROM foo',
      })

      // User edits the query body
      act(() => {
        result.current.setValue('SELECT * FROM bar WHERE id = 1')
      })
      expect(result.current.value).toMatchObject({
        _tag: 'data',
        data: 'SELECT * FROM bar WHERE id = 1',
      })
      expect(setQuery).toHaveBeenCalled() // query gets deselected

      // Now execution starts loading (user submitted the query)
      await act(async () => {
        rerender([
          Model.None, // query is still deselected
          setQuery,
          Model.Pending as Model.Value<requests.QueryExecution>, // execution loading
        ])
        await waitForNextUpdate()
      })
      // queryBody should preserve user input, not become Loading
      expect(result.current.value).toMatchObject({
        _tag: 'data',
        data: 'SELECT * FROM bar WHERE id = 1',
      })
    })
  })
})
