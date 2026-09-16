import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { bucketPackageList, bucketPackageTree, search } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

vi.mock('constants/config', () => ({ default: {}, registryUrl: '' }))

const NAMESPACES = [
  { namespace: 'proj', count: 109 },
  { namespace: 'jobs', count: 37 },
]

// Answer the model's base search with a package result set carrying the facet.
const stats = vi.hoisted(() => ({
  namespaces: [] as { namespace: string; count: number }[],
  truncated: false,
}))

// The model folds several queries. Answer only the base search (the one
// carrying `stats`) with data; the rest stay "fetching", as they would while a
// page loads, so this spec exercises the facet and not the results list.
vi.mock('utils/GraphQL', () => ({
  useQuery: (doc: any) => ({
    fetching: false,
    data: undefined,
    error: undefined,
    doc,
  }),
  fold: (result: any, cfg: any) => {
    const isBaseSearch = result?.doc?.definitions?.[0]?.selectionSet?.selections?.some(
      (s: any) => s.name?.value === 'searchPackages',
    )
    if (!isBaseSearch) return cfg.fetching(result)
    return cfg.data(
      {
        searchPackages: {
          __typename: 'PackagesSearchResultSet',
          stats: {
            namespaces: stats.namespaces,
            namespacesTruncated: stats.truncated,
          },
        },
      },
      { fetching: false },
    )
  },
}))

import NamespaceFacet from './NamespaceFacet'
import * as SearchUIModel from '../model'

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <NamedRoutes.Provider routes={{ search, bucketPackageList, bucketPackageTree }}>
        <SearchUIModel.Provider>
          <NamespaceFacet />
        </SearchUIModel.Provider>
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )

describe('containers/Search/Layout/NamespaceFacet', () => {
  afterEach(() => {
    cleanup()
    stats.namespaces = []
    stats.truncated = false
  })

  it('lists each namespace with its exact count', () => {
    stats.namespaces = NAMESPACES
    const { container } = renderAt('/search')

    expect(container.textContent).toContain('proj/')
    expect(container.textContent).toContain('109')
    expect(container.textContent).toContain('jobs/')
    expect(container.textContent).toContain('37')
  })

  it('links each namespace to the list filtered by it', () => {
    stats.namespaces = NAMESPACES
    const { container } = renderAt('/search')

    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs.some((h) => h?.includes('name=proj%2F'))).toBe(true)
  })

  // A package has exactly one namespace, so the selected one is a destination
  // already reached, not a link back to itself.
  it('renders the active namespace as text, not a link', () => {
    stats.namespaces = NAMESPACES
    const { container } = renderAt('/search?name=proj%2F')

    const linked = Array.from(container.querySelectorAll('a')).map((a) => a.textContent)
    expect(linked).not.toContain('proj/')
    expect(container.textContent).toContain('proj/')
  })

  // A hand-written wildcard is the user's own filter; reading it as a selected
  // namespace would misreport what the list is showing.
  it('treats a hand-written wildcard as no active namespace', () => {
    stats.namespaces = NAMESPACES
    const { container } = renderAt('/search?name=proj%2F*a*')

    const linked = Array.from(container.querySelectorAll('a')).map((a) => a.textContent)
    expect(linked).toContain('proj/')
  })

  it('says so when the list is capped', () => {
    stats.namespaces = NAMESPACES
    stats.truncated = true
    const { container } = renderAt('/search')

    expect(container.textContent).toContain('largest')
  })

  // One namespace is the whole list: there is nothing to choose between.
  it('renders nothing for a single namespace with none active', () => {
    stats.namespaces = [{ namespace: 'proj', count: 5 }]
    const { container } = renderAt('/search')

    expect(container.textContent).toBe('')
  })
})
