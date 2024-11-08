import type A from 'aws-sdk/clients/athena'
import { act, renderHook } from '@testing-library/react-hooks'

import Log from 'utils/Logging'

import * as Model from './utils'
import * as requests from './requests'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

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

const reqTrow = jest.fn(() => ({
  promise: () => {
    throw new Error()
  },
}))

const listDataCatalogs = jest.fn()

const listDatabases = jest.fn()

const listWorkGroups = jest.fn()

const getWorkGroup = jest.fn()

jest.mock(
  'utils/AWS',
  jest.fn(() => ({
    Athena: {
      use: jest.fn(() => ({
        listDataCatalogs,
        listDatabases,
        listWorkGroups,
        getWorkGroup,
      })),
    },
  })),
)

describe('containers/Bucket/Queries/Athena/model/requests', () => {
  describe('useCatalogNames', () => {
    it('return catalog names', async () => {
      listDataCatalogs.mockImplementationOnce(
        req<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>({
          DataCatalogsSummary: [{ CatalogName: 'foo' }, { CatalogName: 'bar' }],
        }),
      )
      const { result, waitFor } = renderHook(() => requests.useCatalogNames())
      expect(result.current.data).toBe(undefined)
      await waitFor(() =>
        expect(result.current.data).toMatchObject({ list: ['foo', 'bar'] }),
      )
    })
    it('return empty list', async () => {
      listDataCatalogs.mockImplementationOnce(
        req<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>({
          DataCatalogsSummary: [],
        }),
      )
      const { result, waitFor } = renderHook(() => requests.useCatalogNames())
      await waitFor(() => expect(result.current.data).toMatchObject({ list: [] }))
    })
    it('return unknowns on invalid data', async () => {
      listDataCatalogs.mockImplementationOnce(
        req<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>({
          // @ts-expect-error
          DataCatalogsSummary: [{ Nonsense: true }, { Absurd: false }],
        }),
      )
      const { result, waitFor } = renderHook(() => requests.useCatalogNames())
      await waitFor(() =>
        expect(result.current.data).toMatchObject({ list: ['Unknown', 'Unknown'] }),
      )
    })
    it('return empty list on invalid data', async () => {
      listDataCatalogs.mockImplementationOnce(
        req<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>({
          // @ts-expect-error
          Invalid: [],
        }),
      )
      const { result, waitFor } = renderHook(() => requests.useCatalogNames())
      await waitFor(() => expect(result.current.data).toMatchObject({ list: [] }))
    })
  })

  describe('useDatabases', () => {
    it('wait for catalogName', async () => {
      const { result, rerender, waitFor } = renderHook(
        (...c: Parameters<typeof requests.useDatabases>) => requests.useDatabases(...c),
        {
          initialProps: undefined,
        },
      )
      rerender(Model.Loading)
      await waitFor(() => result.current.data === Model.Loading)
      const error = new Error('foo')
      rerender(error)
      await waitFor(() => result.current.data instanceof Error)
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

  describe('useWorkgroups', () => {
    listWorkGroups.mockImplementation(
      reqThen<A.ListWorkGroupsInput, A.ListWorkGroupsOutput>(() => ({
        WorkGroups: [{ Name: 'foo' }, { Name: 'bar' }],
      })),
    )

    it('return workgroups', async () => {
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

    it('return only valid workgroups', async () => {
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

    it('handle invalid workgroup', async () => {
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

    it('handle invalid list', async () => {
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

    it('handle fail in workgroup', async () => {
      getWorkGroup.mockImplementation(reqTrow)
      const loglevel = Log.getLevel()
      Log.setLevel('silent')
      const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
      await waitFor(() => typeof result.current.data === 'object')
      expect(result.current.data).toMatchObject({ list: [] })
      unmount()
      Log.setLevel(loglevel)
    })

    it('handle no data in list', async () => {
      listWorkGroups.mockImplementation(
        // @ts-expect-error
        reqThen<A.ListWorkGroupsInput, A.ListWorkGroupsOutput>(() => null),
      )
      const loglevel = Log.getLevel()
      Log.setLevel('silent')
      const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
      await waitFor(() => result.current.data instanceof Error)
      expect(result.current.data).toBeInstanceOf(Error)
      Log.setLevel(loglevel)
      unmount()
    })

    it('handle fail in list', async () => {
      await act(async () => {
        listWorkGroups.mockImplementation(reqTrow)
        const loglevel = Log.getLevel()
        Log.setLevel('silent')
        const { result, unmount, waitFor } = renderHook(() => requests.useWorkgroups())
        await waitFor(() => result.current.data instanceof Error)
        expect(result.current.data).toBeInstanceOf(Error)
        unmount()
        Log.setLevel(loglevel)
      })
    })
  })
})
