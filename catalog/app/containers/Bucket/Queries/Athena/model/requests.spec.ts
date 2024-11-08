import type Athena from 'aws-sdk/clients/athena'
import { renderHook } from '@testing-library/react-hooks'

import * as Model from './utils'
import * as requests from './requests'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

function athenaRequest<I, O>(output: O, delay = 100) {
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

jest.mock(
  'utils/AWS',
  jest.fn(() => ({
    Athena: {
      use: jest.fn(() => ({
        listDataCatalogs: athenaRequest<
          Athena.Types.ListDataCatalogsInput,
          Athena.Types.ListDataCatalogsOutput
        >({
          DataCatalogsSummary: [{ CatalogName: 'foo' }, { CatalogName: 'bar' }],
        }),
        listDatabases: athenaRequest<
          Athena.Types.ListDatabasesInput,
          Athena.Types.ListDatabasesOutput
        >({
          DatabaseList: [{ Name: 'bar' }, { Name: 'baz' }],
        }),
      })),
    },
  })),
)

describe('containers/Bucket/Queries/Athena/model/requests', () => {
  describe('useCatalogNames', () => {
    it('return catalog names', async () => {
      const { result, waitFor } = renderHook(() => requests.useCatalogNames())
      expect(result.current.data).toBe(undefined)
      await waitFor(() =>
        expect(result.current.data).toMatchObject({ list: ['foo', 'bar'] }),
      )
    })
  })

  describe('useDatabases', () => {
    it.skip('wait for catalogName', async () => {
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
      const { result, waitFor } = renderHook(() => requests.useDatabases('foo'))

      expect((result.all[0] as Model.DataController<any>).data).toBe(undefined)
      expect((result.all[1] as Model.DataController<any>).data).toBe(Model.Loading)
      await waitFor(() =>
        expect(result.current.data).toMatchObject({ list: ['bar', 'baz'] }),
      )
    })
  })
})
