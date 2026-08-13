import { renderHook } from '@testing-library/react-hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'

const useQuery = vi.hoisted(() => vi.fn())
const fold = vi.hoisted(() =>
  vi.fn((result: any, cfg: any) => {
    if (result.fetching) return cfg.fetching(result)
    if (result.error) return cfg.error(result, result)
    return cfg.data(result.data, result)
  }),
)
vi.mock('utils/GraphQL', () => ({ useQuery, fold }))

import useRecentlyRevisedPackages from './useRecentlyRevisedPackages'

describe('website/pages/Landing/FrontDoor/useRecentlyRevisedPackages', () => {
  afterEach(() => {
    useQuery.mockReset()
    fold.mockClear()
  })

  it('queries with NEWEST order, latestOnly and no specific buckets', () => {
    useQuery.mockReturnValue({ fetching: true })
    renderHook(() => useRecentlyRevisedPackages())
    const [, variables] = useQuery.mock.calls[0]
    expect(variables).toEqual({ buckets: null, order: 'NEWEST' })
  })

  it('maps and bounds package hits from the server response', () => {
    useQuery.mockReturnValue({
      fetching: false,
      data: {
        searchPackages: {
          __typename: 'PackagesSearchResultSet',
          total: 2,
          firstPage: {
            hits: [
              {
                id: 'h1',
                bucket: 'b1',
                name: 'a/one',
                hash: 'hash1',
                pointer: 'latest',
                modified: new Date('2024-01-02T00:00:00Z'),
              },
              {
                id: 'h2',
                bucket: 'b2',
                name: 'a/two',
                hash: 'hash2',
                pointer: 'abc',
                modified: new Date('2024-01-01T00:00:00Z'),
              },
            ],
          },
        },
      },
    })
    const { result } = renderHook(() => useRecentlyRevisedPackages(1))
    expect(result.current.fetching).toBe(false)
    expect(result.current.error).toBe(false)
    expect(result.current.packages).toEqual([
      {
        id: 'h1',
        bucket: 'b1',
        name: 'a/one',
        hash: 'hash1',
        pointer: 'latest',
        modified: new Date('2024-01-02T00:00:00Z'),
      },
    ])
  })

  it('reports an error for OperationError results', () => {
    useQuery.mockReturnValue({
      data: {
        searchPackages: {
          __typename: 'OperationError',
          name: 'Boom',
          message: 'nope',
        },
      },
    })
    const { result } = renderHook(() => useRecentlyRevisedPackages())
    expect(result.current.error).toBe(true)
    expect(result.current.packages).toEqual([])
  })

  it('treats an empty result set as a clean empty state', () => {
    useQuery.mockReturnValue({
      data: { searchPackages: { __typename: 'EmptySearchResultSet' } },
    })
    const { result } = renderHook(() => useRecentlyRevisedPackages())
    expect(result.current.error).toBe(false)
    expect(result.current.packages).toEqual([])
  })
})
