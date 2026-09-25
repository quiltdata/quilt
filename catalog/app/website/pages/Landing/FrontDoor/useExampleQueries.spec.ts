import { renderHook } from '@testing-library/react-hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'

const useRelevantBuckets = vi.hoisted(() => vi.fn(() => [] as any[]))
vi.mock('utils/Buckets', () => ({ useRelevantBuckets }))

const useRecentlyRevisedPackages = vi.hoisted(() =>
  vi.fn(() => ({ fetching: false, error: false, packages: [] as any[] })),
)
vi.mock('./useRecentlyRevisedPackages', () => ({ default: useRecentlyRevisedPackages }))

import useExampleQueries, { DEFAULT_EXAMPLES, shareOut } from './useExampleQueries'

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

  it('derives a prompt carrying the package handle verbatim', () => {
    useRecentlyRevisedPackages.mockReturnValue({
      fetching: false,
      error: false,
      packages: [{ name: 'alexwilson/drugbank-test' }],
    })
    const { result } = renderHook(() => useExampleQueries())
    expect(result.current[0]).toEqual({
      icon: 'inventory_2',
      label: "What's in the alexwilson/drugbank-test package?",
      code: 'alexwilson/drugbank-test',
    })
  })

  it('gives every source a turn before any takes a second slot', () => {
    useRecentlyRevisedPackages.mockReturnValue({
      fetching: false,
      error: false,
      packages: Array.from({ length: 5 }, (_, i) => ({ name: `ns/pkg-${i}` })),
    })
    useRelevantBuckets.mockReturnValue([
      { name: 'a', title: 'A', tags: ['x', 'y', 'z'] },
      { name: 'b', title: 'B' },
    ])
    const { result } = renderHook(() => useExampleQueries())
    const byIcon = result.current.reduce<Record<string, number>>((acc, e) => {
      acc[e.icon] = (acc[e.icon] || 0) + 1
      return acc
    }, {})
    expect(byIcon).toEqual({ inventory_2: 2, summarize: 2, folder: 1 })
  })

  it('lets one source fill the row when the others are empty', () => {
    useRecentlyRevisedPackages.mockReturnValue({
      fetching: false,
      error: false,
      packages: Array.from({ length: 5 }, (_, i) => ({ name: `ns/pkg-${i}` })),
    })
    const { result } = renderHook(() => useExampleQueries())
    expect(result.current.every((e) => e.icon === 'inventory_2')).toBe(true)
    expect(result.current).toHaveLength(5)
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

describe('website/pages/Landing/FrontDoor/useExampleQueries/shareOut', () => {
  it('shares turns round-robin and hands on what a dry source cannot use', () => {
    expect(shareOut([5, 3, 9], 5)).toEqual([2, 2, 1])
    expect(shareOut([5, 0, 0], 5)).toEqual([5, 0, 0])
    expect(shareOut([1, 1, 1], 5)).toEqual([1, 1, 1])
    expect(shareOut([0, 0, 0], 5)).toEqual([0, 0, 0])
    expect(shareOut([], 5)).toEqual([])
  })
})
