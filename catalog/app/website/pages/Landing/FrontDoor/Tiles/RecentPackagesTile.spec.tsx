import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RecentlyRevisedState } from '../useRecentlyRevisedPackages'

const useRecentlyRevisedPackages = vi.hoisted(() =>
  vi.fn<() => RecentlyRevisedState>(() => ({
    fetching: false,
    error: false,
    packages: [],
  })),
)
vi.mock('../useRecentlyRevisedPackages', () => ({
  default: useRecentlyRevisedPackages,
  RECENT_PACKAGES_LIMIT: 5,
}))

vi.mock('utils/format', () => ({ Relative: () => <span>recently</span> }))

import RecentPackagesTile from './RecentPackagesTile'

const renderTile = () =>
  render(
    <MemoryRouter>
      <RecentPackagesTile />
    </MemoryRouter>,
  )

describe('website/pages/Landing/FrontDoor/Tiles/RecentPackagesTile', () => {
  afterEach(() => {
    cleanup()
    useRecentlyRevisedPackages.mockReset()
    useRecentlyRevisedPackages.mockReturnValue({
      fetching: false,
      error: false,
      packages: [],
    })
  })

  it('renders the loading state', () => {
    useRecentlyRevisedPackages.mockReturnValue({
      fetching: true,
      error: false,
      packages: [],
    })
    const { getByText } = renderTile()
    expect(getByText('Loading recent revisions…')).toBeTruthy()
  })

  it('renders the empty state independent of browser history', () => {
    const { getByText } = renderTile()
    expect(getByText('Recent packages')).toBeTruthy()
    expect(getByText('No recent package revisions found')).toBeTruthy()
  })

  it('renders an error state instead of falling back to local history', () => {
    useRecentlyRevisedPackages.mockReturnValue({
      fetching: false,
      error: true,
      packages: [],
    })
    const { getByText } = renderTile()
    expect(getByText('Couldn’t load recent packages')).toBeTruthy()
  })

  it('renders server-backed package rows with bucket context and links', () => {
    useRecentlyRevisedPackages.mockReturnValue({
      fetching: false,
      error: false,
      packages: [
        {
          id: 'h1',
          bucket: 'quilt-drugbanks',
          name: 'owner/drugbank',
          hash: 'abc123',
          pointer: 'latest',
          modified: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    })
    const { getByText, container } = renderTile()
    expect(getByText('owner/drugbank')).toBeTruthy()
    expect(getByText(/quilt-drugbanks/)).toBeTruthy()
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/b/quilt-drugbanks/packages/owner/drugbank')
  })
})
