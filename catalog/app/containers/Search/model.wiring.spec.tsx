import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { search } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

vi.mock('constants/config', () => ({ default: {}, registryUrl: '' }))

// Capture every GraphQL call the real model makes, answering "fetching" so the
// provider renders without a client. What this spec guards is the seam the
// pure-function specs can't: that the ordering parsed from the URL actually
// arrives in the query variables (verbatim for packages; mapped through the
// lossy enum boundary for objects).
const captured = vi.hoisted(() => ({ calls: [] as any[] }))

vi.mock('utils/GraphQL', () => ({
  useQuery: (doc: any, variables: any, opts?: any) => {
    captured.calls.push({ doc, variables, opts })
    return { fetching: true, data: undefined, error: undefined }
  },
  fold: (result: any, cfg: any) => cfg.fetching(result),
}))

import FIRST_PAGE_OBJECTS_QUERY from './gql/FirstPageObjects.generated'
import FIRST_PAGE_PACKAGES_QUERY from './gql/FirstPagePackages.generated'
import * as SearchUIModel from './model'

const renderModelAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <NamedRoutes.Provider routes={{ search }}>
        <SearchUIModel.Provider>{null}</SearchUIModel.Provider>
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )

const callsFor = (doc: unknown) => captured.calls.filter((c) => c.doc === doc)

describe('containers/Search/model (URL → GraphQL variables wiring)', () => {
  afterEach(() => {
    cleanup()
    captured.calls.length = 0
  })

  it('passes a user-meta ordering expression verbatim to the packages query', () => {
    renderModelAt('/search?q=x&s=usr:/study/phase:keyword:asc')
    const [call] = callsFor(FIRST_PAGE_PACKAGES_QUERY)
    expect(call).toBeDefined()
    expect(call.variables.ordering).toBe('usr:/study/phase:keyword:asc')
    // packages is the active result type, so this query must actually run
    expect(call.opts?.pause).toBe(false)
  })

  it('passes a system-field ordering verbatim to the packages query', () => {
    renderModelAt('/search?q=x&s=sys:modified:desc')
    const [call] = callsFor(FIRST_PAGE_PACKAGES_QUERY)
    expect(call.variables.ordering).toBe('sys:modified:desc')
  })

  it('maps a preset ordering to the enum at the objects boundary', () => {
    renderModelAt('/search?q=x&t=o&s=sys:modified:desc')
    const [call] = callsFor(FIRST_PAGE_OBJECTS_QUERY)
    expect(call).toBeDefined()
    expect(call.variables.order).toBe(SearchUIModel.GQLResultOrder.NEWEST)
    expect(call.opts?.pause).toBe(false)
  })

  it('degrades a pointer ordering to BEST_MATCH for objects (lossy boundary)', () => {
    renderModelAt('/search?q=x&t=o&s=usr:/study/phase:keyword:asc')
    const [call] = callsFor(FIRST_PAGE_OBJECTS_QUERY)
    expect(call.variables.order).toBe(SearchUIModel.GQLResultOrder.BEST_MATCH)
  })

  it('pauses the query for the inactive result type', () => {
    renderModelAt('/search?q=x&s=sys:modified:desc')
    const [objects] = callsFor(FIRST_PAGE_OBJECTS_QUERY)
    expect(objects.opts?.pause).toBe(true)
  })
})
