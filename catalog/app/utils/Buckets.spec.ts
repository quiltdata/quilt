import { renderHook } from '@testing-library/react-hooks'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const useQuerySMock = vi.fn()

vi.mock('constants/config', () => ({
  default: { mode: 'LOCAL', alwaysRequiresAuth: false },
}))
vi.mock('react-redux', () => ({ useSelector: () => true }))
vi.mock('react-router-dom', () => ({ useRouteMatch: () => null }))
vi.mock('utils/GraphQL', () => ({
  useQueryS: (...args: unknown[]) => useQuerySMock(...args),
  Paused: class Paused extends Error {},
}))
vi.mock('utils/NamedRoutes', () => ({ use: () => ({ paths: {} }) }))
vi.mock('./Buckets.generated', () => ({ default: 'PRODUCT_QUERY' }))

import { useRelevantBuckets, useCurrentBucket, useIsInStack } from './Buckets'

describe('utils/Buckets', () => {
  beforeEach(() => {
    useQuerySMock.mockReset()
  })

  describe('useRelevantBuckets (LOCAL mode)', () => {
    it('normalizes BucketConfig __typename to Bucket', () => {
      useQuerySMock.mockReturnValue({
        buckets: [
          {
            __typename: 'BucketConfig',
            name: 'alpha',
            title: 'Alpha',
            iconUrl: null,
            description: 'Bucket A',
            tags: ['tag1'],
            relevanceScore: 10,
          },
        ],
      })

      const { result } = renderHook(() => useRelevantBuckets())
      expect(result.current).toEqual([
        {
          __typename: 'Bucket',
          name: 'alpha',
          title: 'Alpha',
          iconUrl: null,
          description: 'Bucket A',
          tags: ['tag1'],
          relevanceScore: 10,
        },
      ])
    })

    it('filters out buckets with negative relevanceScore', () => {
      useQuerySMock.mockReturnValue({
        buckets: [
          {
            __typename: 'BucketConfig',
            name: 'visible',
            title: 'V',
            iconUrl: null,
            description: '',
            tags: [],
            relevanceScore: 5,
          },
          {
            __typename: 'BucketConfig',
            name: 'hidden',
            title: 'H',
            iconUrl: null,
            description: '',
            tags: [],
            relevanceScore: -1,
          },
        ],
      })

      const { result } = renderHook(() => useRelevantBuckets())
      expect(result.current).toHaveLength(1)
      expect(result.current[0].name).toBe('visible')
    })

    it('sorts by relevanceScore descending then name ascending', () => {
      useQuerySMock.mockReturnValue({
        buckets: [
          {
            __typename: 'BucketConfig',
            name: 'charlie',
            title: '',
            iconUrl: null,
            description: '',
            tags: [],
            relevanceScore: 5,
          },
          {
            __typename: 'BucketConfig',
            name: 'alpha',
            title: '',
            iconUrl: null,
            description: '',
            tags: [],
            relevanceScore: 10,
          },
          {
            __typename: 'BucketConfig',
            name: 'bravo',
            title: '',
            iconUrl: null,
            description: '',
            tags: [],
            relevanceScore: 5,
          },
        ],
      })

      const { result } = renderHook(() => useRelevantBuckets())
      expect(result.current.map((b) => b.name)).toEqual(['alpha', 'bravo', 'charlie'])
    })

    it('returns empty array when query data has no buckets', () => {
      useQuerySMock.mockReturnValue({ buckets: [] })
      const { result } = renderHook(() => useRelevantBuckets())
      expect(result.current).toEqual([])
    })
  })

  describe('useCurrentBucket', () => {
    it('returns undefined when no route matches', () => {
      const { result } = renderHook(() => useCurrentBucket())
      expect(result.current).toBeUndefined()
    })
  })

  describe('useIsInStack', () => {
    it('returns true for buckets in the list', () => {
      useQuerySMock.mockReturnValue({
        buckets: [
          {
            __typename: 'BucketConfig',
            name: 'my-bucket',
            title: '',
            iconUrl: null,
            description: '',
            tags: [],
            relevanceScore: 0,
          },
        ],
      })

      const { result } = renderHook(() => useIsInStack())
      expect(result.current('my-bucket')).toBe(true)
      expect(result.current('other-bucket')).toBe(false)
    })
  })
})
