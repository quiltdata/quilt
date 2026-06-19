import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
      <BucketsTile />
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

  it('expands to reveal all buckets and sort controls', () => {
    useRelevantBuckets.mockReturnValue(mkBuckets(7))
    const { getByText } = renderTile()
    fireEvent.click(getByText('View all 7 buckets'))
    expect(getByText('bucket-06')).toBeTruthy()
    expect(getByText('Relevant')).toBeTruthy()
    expect(getByText('A-Z')).toBeTruthy()
    expect(getByText('Show less')).toBeTruthy()
  })

  it('sorts alphabetically by title/name when A-Z is selected', () => {
    useRelevantBuckets.mockReturnValue([
      { name: 'zebra' },
      { name: 'alpha' },
      { name: 'mango' },
      { name: 'beta' },
      { name: 'omega' },
    ])
    const { getByText, getAllByText } = renderTile()
    fireEvent.click(getByText('View all 5 buckets'))
    fireEvent.click(getByText('A-Z'))
    const links = getAllByText(/alpha|beta|mango|omega|zebra/)
    expect(links[0].textContent).toBe('alpha')
  })

  it('orders by locally-visited buckets when Recent is selected', () => {
    useRelevantBuckets.mockReturnValue([
      { name: 'alpha' },
      { name: 'beta' },
      { name: 'gamma' },
      { name: 'delta' },
      { name: 'epsilon' },
    ])
    useRecentPackages.mockReturnValue([{ bucket: 'gamma' }, { bucket: 'delta' }])
    const { getByText, getAllByText } = renderTile()
    fireEvent.click(getByText('View all 5 buckets'))
    fireEvent.click(getByText('Recent'))
    const links = getAllByText(/alpha|beta|gamma|delta|epsilon/)
    expect(links[0].textContent).toBe('gamma')
    expect(links[1].textContent).toBe('delta')
  })
})
