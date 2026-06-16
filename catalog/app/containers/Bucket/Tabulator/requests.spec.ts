import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, type Mock } from 'vitest'

import * as Model from '../Queries/Athena/model/utils'

import { useTabulatorTables } from './requests'

vi.mock('constants/config', () => ({ default: {} }))

// Mock only `useQuery` and keep the real `fold` so the fold mapping under test runs for real.
const useQuery: Mock = vi.fn()
vi.mock('utils/GraphQL', async () => ({
  ...(await vi.importActual('utils/GraphQL')),
  useQuery: () => useQuery(),
}))

describe('containers/Bucket/Tabulator/requests', () => {
  describe('useTabulatorTables', () => {
    it('treats a null bucketConfig as no tables', () => {
      useQuery.mockReturnValue({
        fetching: false,
        error: undefined,
        data: { __typename: 'Query', bucketConfig: null },
      })

      const { result } = renderHook(() => useTabulatorTables('test-bucket'))

      expect(result.current).toEqual([])
    })

    it('returns the tabulator tables from bucketConfig', () => {
      useQuery.mockReturnValue({
        fetching: false,
        error: undefined,
        data: {
          __typename: 'Query',
          bucketConfig: {
            __typename: 'BucketConfig',
            name: 'test-bucket',
            tabulatorTables: [{ __typename: 'TabulatorTable', name: 't1' }],
          },
        },
      })

      const { result } = renderHook(() => useTabulatorTables('test-bucket'))

      expect(result.current).toEqual([{ __typename: 'TabulatorTable', name: 't1' }])
    })

    it('yields Loading while fetching', () => {
      useQuery.mockReturnValue({ fetching: true, error: undefined, data: undefined })

      const { result } = renderHook(() => useTabulatorTables('test-bucket'))

      expect(result.current).toBe(Model.Loading)
    })

    it('yields the error when the query fails', () => {
      const error = new Error('boom')
      useQuery.mockReturnValue({ fetching: false, error, data: undefined })

      const { result } = renderHook(() => useTabulatorTables('test-bucket'))

      expect(result.current).toBe(error)
    })
  })
})
