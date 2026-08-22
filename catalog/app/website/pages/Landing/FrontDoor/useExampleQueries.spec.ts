import { renderHook } from '@testing-library/react-hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'

const useRelevantBuckets = vi.hoisted(() => vi.fn(() => [] as any[]))
vi.mock('utils/Buckets', () => ({ useRelevantBuckets }))

const useRecentlyRevisedPackages = vi.hoisted(() =>
  vi.fn(() => ({ fetching: false, error: false, packages: [] as any[] })),
)
vi.mock('./useRecentlyRevisedPackages', () => ({ default: useRecentlyRevisedPackages }))

import useExampleQueries, { DEFAULT_EXAMPLES } from './useExampleQueries'

describe('website/pages/Landing/FrontDoor/useExampleQueries', () => {
  afterEach(() => {
    useRelevantBuckets.mockReset()
    useRelevantBuckets.mockReturnValue([])
    useRecentlyRevisedPackages.mockReset()
    useRecentlyRevisedPackages.mockReturnValue({
      fetching: false,
      error: false,
      packages: [],
    })
  })

  it('falls back to the generic set when there is no catalog data', () => {
    const { result } = renderHook(() => useExampleQueries())
    expect(result.current).toEqual(DEFAULT_EXAMPLES)
  })

  it('derives a prompt from a recently-revised package name', () => {
    useRecentlyRevisedPackages.mockReturnValue({
      fetching: false,
      error: false,
      packages: [{ name: 'alexwilson/drugbank-test' }],
    })
    const { result } = renderHook(() => useExampleQueries())
    expect(result.current[0]).toEqual({
      icon: 'inventory_2',
      label: "What's in the drugbank test package?",
    })
  })

  it('derives prompts from bucket tags and titles', () => {
    useRelevantBuckets.mockReturnValue([
      { name: 'genomics-bucket', title: 'Genomics', tags: ['rnaseq'] },
    ])
    const { result } = renderHook(() => useExampleQueries())
    const labels = result.current.map((e) => e.label)
    expect(labels).toContain('Summarize the rnaseq data across my buckets')
    expect(labels).toContain('Show me the latest packages in Genomics')
  })

  it('bounds the output to the requested limit and dedupes', () => {
    useRelevantBuckets.mockReturnValue([
      { name: 'a', title: 'A', tags: ['x'] },
      { name: 'b', title: 'B', tags: ['x'] },
    ])
    const { result } = renderHook(() => useExampleQueries(3))
    expect(result.current).toHaveLength(3)
    const labels = result.current.map((e) => e.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
