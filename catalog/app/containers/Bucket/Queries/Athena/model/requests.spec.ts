import type A from 'aws-sdk/clients/athena'
import { renderHook } from '@testing-library/react-hooks'

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

const listDataCatalogs = jest.fn()

const listDatabases = jest.fn()

jest.mock(
  'utils/AWS',
  jest.fn(() => ({
    Athena: {
      use: jest.fn(() => ({
        listDataCatalogs,
        listDatabases,
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
})
