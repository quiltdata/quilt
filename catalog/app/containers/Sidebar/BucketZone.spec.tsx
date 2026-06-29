import { describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

import { filterBuckets } from './BucketZone'

const bs = [
  { name: 'alpha', title: 'Alpha' },
  { name: 'beta', title: 'Beta bucket' },
]

describe('filterBuckets', () => {
  it('returns all buckets for empty query', () => {
    expect(filterBuckets(bs, '').map((b) => b.name)).toEqual(['alpha', 'beta'])
  })

  it('filters by name substring', () => {
    expect(filterBuckets(bs, 'bet').map((b) => b.name)).toEqual(['beta'])
  })

  it('filters case-insensitively by name', () => {
    expect(filterBuckets(bs, 'ALPHA').map((b) => b.name)).toEqual(['alpha'])
  })

  it('filters by title substring', () => {
    expect(filterBuckets(bs, 'bucket').map((b) => b.name)).toEqual(['beta'])
  })
})
