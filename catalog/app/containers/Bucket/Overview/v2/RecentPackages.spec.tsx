import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as NamedRoutes from 'utils/NamedRoutes'

import RecentPackages from './RecentPackages'

vi.mock('constants/config', () => ({ default: {} }))

type FoldState = 'data' | 'fetching' | 'empty' | 'invalid' | 'opError' | 'networkError'
let foldState: FoldState = 'data'

const HITS = [
  {
    id: '1',
    bucket: 'b',
    name: 'team/alpha',
    pointer: 'latest',
    hash: 'h1',
    size: 1024,
    modified: new Date('2026-06-18T00:00:00Z'),
  },
  {
    id: '2',
    bucket: 'b',
    name: 'team/beta',
    pointer: 'latest',
    hash: 'h2',
    size: 2048,
    modified: new Date('2026-06-17T00:00:00Z'),
  },
]

vi.mock('utils/GraphQL', () => ({
  useQuery: () => ({}),
  fold: (
    _q: unknown,
    handlers: {
      data: (d: unknown) => unknown
      fetching: () => unknown
      error: (e: Error) => unknown
    },
  ) => {
    if (foldState === 'fetching') return handlers.fetching()
    if (foldState === 'networkError') return handlers.error(new Error('network boom'))
    if (foldState === 'invalid')
      return handlers.data({
        searchPackages: {
          __typename: 'InvalidInput',
          errors: [{ message: 'bad query' }],
        },
      })
    if (foldState === 'opError')
      return handlers.data({
        searchPackages: { __typename: 'OperationError', message: 'op failed' },
      })
    const hits = foldState === 'empty' ? [] : HITS
    const total = foldState === 'empty' ? 0 : 5
    return handlers.data({
      searchPackages: {
        __typename: 'PackagesSearchResultSet',
        total,
        firstPage: { hits },
      },
    })
  },
}))

const routes = {
  bucketPackageTree: {
    path: '',
    url: (b: string, name: string, rev: string) => `/b/${b}/packages/${name}/tree/${rev}`,
  },
  bucketPackageList: { path: '', url: (b: string) => `/b/${b}/packages` },
}

function renderRecent() {
  return render(
    <MemoryRouter>
      <NamedRoutes.Provider routes={routes}>
        <RecentPackages bucket="b" />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

describe('containers/Bucket/Overview/v2/RecentPackages', () => {
  afterEach(() => {
    cleanup()
    foldState = 'data'
  })

  it('renders the latest packages with a link to each and the remaining count', () => {
    const { getByText } = renderRecent()
    expect(getByText('team/alpha').closest('a')!.getAttribute('href')).toBe(
      '/b/b/packages/team/alpha/tree/latest',
    )
    expect(getByText('team/beta')).toBeTruthy()
    // total 5, showing 2 -> "3 more packages"
    const more = getByText(/3 more packages/i).closest('a')
    expect(more!.getAttribute('href')).toBe('/b/b/packages')
  })

  it('shows skeletons (and the title) while loading, without package names', () => {
    foldState = 'fetching'
    const { queryByText, getByText } = renderRecent()
    expect(getByText('Latest packages')).toBeTruthy()
    expect(queryByText(/more package/i)).toBeNull()
    expect(queryByText('team/alpha')).toBeNull()
  })

  it('renders nothing when the bucket has no packages', () => {
    foldState = 'empty'
    const { container } = renderRecent()
    expect(container.textContent).toBe('')
  })

  it('surfaces an InvalidInput error in an alert', () => {
    foldState = 'invalid'
    const { getByRole } = renderRecent()
    expect(getByRole('alert').textContent).toMatch(/bad query/)
  })

  it('surfaces an OperationError in an alert', () => {
    foldState = 'opError'
    const { getByRole } = renderRecent()
    expect(getByRole('alert').textContent).toMatch(/op failed/)
  })

  it('surfaces a network error in an alert', () => {
    foldState = 'networkError'
    const { getByRole } = renderRecent()
    expect(getByRole('alert').textContent).toMatch(/network boom/)
  })
})
