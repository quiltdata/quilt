import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { bucketPackageList, bucketPackageTree, search } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

vi.mock('constants/config', () => ({ default: {}, registryUrl: '' }))

// The real model issues its queries on mount; answer "fetching" so the provider
// renders without a GraphQL client.
vi.mock('utils/GraphQL', () => ({
  useQuery: () => ({ fetching: true, data: undefined, error: undefined }),
  fold: (result: any, cfg: any) => cfg.fetching(result),
}))

import PackageHandle, { splitHandle } from './NamespaceLink'
import * as SearchUIModel from './model'

const TREE_URL = '/b/foo/packages/pkg/name'

/** Inside a package search, as the Packages tab mounts it (base = the tab's URL). */
const renderInPackageSearch = (handle: string, base?: string) =>
  render(
    <MemoryRouter initialEntries={[base ?? '/search?t=p']}>
      <NamedRoutes.Provider routes={{ search, bucketPackageList, bucketPackageTree }}>
        <SearchUIModel.Provider base={base}>
          <PackageHandle handle={handle} to={TREE_URL} />
        </SearchUIModel.Provider>
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )

const hrefs = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('a')).map((a) => a.getAttribute('href'))

describe('containers/Search/NamespaceLink', () => {
  afterEach(cleanup)

  describe('splitHandle', () => {
    it('splits a well-formed handle at the slash', () => {
      expect(splitHandle('proj/experiment-1')).toEqual({
        namespace: 'proj',
        name: 'experiment-1',
      })
    })

    // A handle off a search hit is registry data, not validated input: anything
    // that is not `namespace/name` must degrade to a plain name rather than
    // linking to a namespace that cannot exist.
    it.each([
      ['no slash', 'justaname'],
      ['leading slash (empty namespace)', '/name'],
      ['trailing slash (empty name)', 'proj/'],
      ['empty', ''],
    ])('returns no namespace for %s', (_label, handle) => {
      expect(splitHandle(handle)).toEqual({ namespace: null, name: handle })
    })

    // quilt3's PACKAGE_NAME_FORMAT allows exactly one slash, but splitting on the
    // FIRST one keeps any extra in the name instead of silently dropping it.
    it('splits on the first slash only', () => {
      expect(splitHandle('a/b/c')).toEqual({ namespace: 'a', name: 'b/c' })
    })
  })

  it('links the namespace to the list filtered by that prefix', () => {
    const { container } = renderInPackageSearch('proj/experiment-1')

    const [namespaceHref] = hrefs(container)
    // The trailing slash is the point: the model appends `*`, so `proj/` cannot
    // also match the namespace `projects`.
    expect(namespaceHref).toContain('name=proj%2F')
  })

  it('links the package name to the package itself', () => {
    const { container } = renderInPackageSearch('proj/experiment-1')

    expect(hrefs(container)).toContain(TREE_URL)
  })

  it('keeps the namespace link on the surface the model belongs to', () => {
    const { container } = renderInPackageSearch('proj/experiment-1', '/b/foo/packages/')

    // Not global /search: a namespace click inside a bucket's Packages tab must
    // not navigate out of that bucket.
    const [namespaceHref] = hrefs(container)
    expect(namespaceHref).toMatch(/^\/b\/foo\/packages\//)
  })

  it('renders the whole handle', () => {
    const { container } = renderInPackageSearch('proj/experiment-1')

    expect(container.textContent).toBe('proj/experiment-1')
  })

  it('renders a slashless handle as a single unlinked name', () => {
    const { container } = renderInPackageSearch('justaname')

    expect(container.textContent).toBe('justaname')
    expect(hrefs(container)).toEqual([TREE_URL])
  })

  // Leaf components render outside the provider (see CellValue.spec, Hit.spec).
  // A namespace link is an affordance on a list, never a precondition for
  // naming a package.
  it('renders without a SearchUIModel.Provider above it', () => {
    const { container } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageTree }}>
          <PackageHandle handle="proj/experiment-1" to={TREE_URL} />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    expect(container.textContent).toBe('proj/experiment-1')
    expect(hrefs(container)).toEqual([TREE_URL])
  })
})
