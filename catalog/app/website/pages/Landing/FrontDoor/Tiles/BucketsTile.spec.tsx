import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as NamedRoutes from 'utils/NamedRoutes'
import * as routes from 'constants/routes'

vi.mock('constants/config', () => ({ default: {} }))

const useRelevantBuckets = vi.hoisted(() =>
  vi.fn(() => [] as { name: string; title?: string }[]),
)
vi.mock('utils/Buckets', () => ({ useRelevantBuckets }))

const useRecentPackages = vi.hoisted(() => vi.fn(() => [] as { bucket?: string }[]))
vi.mock('../useRecentPackages', () => ({ default: useRecentPackages }))

import BucketsTile from './BucketsTile'

const renderTile = () =>
  render(
    <MemoryRouter>
      <NamedRoutes.Provider routes={routes}>
        <BucketsTile />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )

const mkBuckets = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `bucket-${String(i).padStart(2, '0')}` }))

describe('website/pages/Landing/FrontDoor/Tiles/BucketsTile', () => {
  afterEach(() => {
    cleanup()
    useRelevantBuckets.mockReset()
    useRelevantBuckets.mockReturnValue([])
    useRecentPackages.mockReset()
    useRecentPackages.mockReturnValue([])
    try {
      window.localStorage.clear()
    } catch {
      // ignore
    }
  })

  it('renders an empty state when there are no buckets', () => {
    const { getByText } = renderTile()
    expect(getByText('Buckets')).toBeTruthy()
    expect(getByText('No buckets yet')).toBeTruthy()
  })

  it('bounds the collapsed list to four buckets with a view-all affordance', () => {
    useRelevantBuckets.mockReturnValue(mkBuckets(7))
    const { getByText, queryByText } = renderTile()
    expect(getByText('bucket-00')).toBeTruthy()
    expect(getByText('bucket-03')).toBeTruthy()
    expect(queryByText('bucket-04')).toBeNull()
    expect(getByText('View all 7 buckets')).toBeTruthy()
  })

  it('links the view-all affordance to the /buckets page', () => {
    useRelevantBuckets.mockReturnValue(mkBuckets(7))
    const { getByText } = renderTile()
    const link = getByText('View all 7 buckets').closest('a')
    expect(link?.getAttribute('href')).toBe('/buckets')
  })

  it('shows a browse-all affordance even when nothing is truncated', () => {
    useRelevantBuckets.mockReturnValue(mkBuckets(2))
    const { getByText } = renderTile()
    const link = getByText('Browse all buckets').closest('a')
    expect(link?.getAttribute('href')).toBe('/buckets')
  })
})
