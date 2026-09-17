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

// Answer only this facet's own query (gql/Namespaces); the model's other
// queries stay "fetching", so the spec exercises the facet, not the result
// list. `failing` makes that query error, as it does against a registry
// predating the field.
const failing = vi.hoisted(() => ({ value: false }))

vi.mock('utils/GraphQL', () => ({
  useQuery: (doc: any) => ({
    fetching: false,
    data: undefined,
    error: undefined,
    doc,
  }),
  fold: (result: any, cfg: any) => {
    const op = result?.doc?.definitions?.[0]
    const selectsNamespaces = JSON.stringify(op ?? {}).includes('namespaces')
    if (!selectsNamespaces) return cfg.fetching(result)
    if (failing.value) return cfg.error(new Error('Cannot query field'), result)
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
    failing.value = false
  })

  // The whole reason this facet has its own query: a registry predating the
  // `namespaces` field rejects it at validation. That must cost the facet and
  // nothing else, so the facet renders nothing rather than surfacing an error.
  it('renders nothing when the registry does not serve the field', () => {
    stats.namespaces = NAMESPACES
    failing.value = true
    const { container } = renderAt('/search')

    expect(container.textContent).toBe('')
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
