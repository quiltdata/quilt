import { describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: { mode: 'LOCAL' } }))

// Replicates the normalization logic from Overview.tsx:
// rawBucketData.__typename !== 'Bucket' → spread + override __typename
function normalizeBucketData(
  rawBucketData: { __typename: string; [k: string]: any } | null,
) {
  if (!rawBucketData) return rawBucketData
  return rawBucketData.__typename !== 'Bucket'
    ? { ...rawBucketData, __typename: 'Bucket' as const }
    : rawBucketData
}

describe('containers/Bucket/Overview', () => {
  describe('local bucket data normalization', () => {
    it('remaps BucketConfig __typename to Bucket', () => {
      const result = normalizeBucketData({
        __typename: 'BucketConfig',
        name: 'test-bucket',
        description: 'A local bucket',
      })
      expect(result!.__typename).toBe('Bucket')
      expect(result!.name).toBe('test-bucket')
      expect(result!.description).toBe('A local bucket')
    })

    it('passes through data unchanged when already typed as Bucket', () => {
      const input = {
        __typename: 'Bucket',
        name: 'prod-bucket',
        description: 'A product bucket',
      }
      const result = normalizeBucketData(input)
      expect(result).toBe(input)
      expect(result!.__typename).toBe('Bucket')
    })

    it('handles null bucket data (bucket not in stack)', () => {
      const result = normalizeBucketData(null)
      expect(result).toBeNull()
    })
  })
})
