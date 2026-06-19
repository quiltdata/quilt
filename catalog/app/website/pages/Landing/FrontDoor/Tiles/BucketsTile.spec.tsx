import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

const useRelevantBuckets = vi.fn(() => [] as { name: string }[])
vi.mock('utils/Buckets', () => ({ useRelevantBuckets: () => useRelevantBuckets() }))

import BucketsTile from './BucketsTile'

describe('website/pages/Landing/FrontDoor/Tiles/BucketsTile', () => {
  afterEach(() => {
    cleanup()
    useRelevantBuckets.mockReset()
    useRelevantBuckets.mockReturnValue([])
  })

  it('renders an empty state when there are no buckets', () => {
    useRelevantBuckets.mockReturnValue([])
    const { getByText } = render(<BucketsTile />)
    expect(getByText('Buckets')).toBeTruthy()
    expect(getByText('No buckets yet')).toBeTruthy()
  })

  it('lists relevant buckets with links', () => {
    useRelevantBuckets.mockReturnValue([
      { name: 'quilt-drugbank' },
      { name: 'allencell' },
    ])
    const { getByText } = render(<BucketsTile />)
    expect(getByText('quilt-drugbank')).toBeTruthy()
    expect(getByText('allencell')).toBeTruthy()
  })
})
