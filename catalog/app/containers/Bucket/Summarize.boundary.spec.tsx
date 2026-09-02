import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

import { bucketFile } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

// Containment spec for the summarize panels' boundary.
//
// A summary renders one panel per quilt_summarize.json entry, and every panel's
// preview renderer runs in the same render pass. With no boundary between them
// and `Errors.ErrorBoundary` in app.tsx, a single entry whose renderer threw --
// a malformed Vega spec, a Perspective config that won't apply -- replaced the
// entire catalog with the app-level error screen, costing the user every other
// panel in the summary along with it.
//
// Note the sibling `Summarize.spec.tsx` mocks `components/Preview` to `{}`, so
// no test there can observe this. This one mocks it at the same seam but lets a
// chosen entry's renderer throw.

vi.mock('constants/config', () => ({ default: {} }))

// The entries `bucketSummary` reports, and the keys whose renderer throws, are
// both per-test so one entry can fail while its siblings are asserted intact.
const state = vi.hoisted(() => ({
  entries: [] as {
    handle: { bucket: string; key: string; version?: string }
    path: string
  }[],
  throwFor: new Set<string>(),
}))

vi.mock('components/Preview', () => ({
  CONTEXT: { LISTING: 'listing' },
  getRenderProps: () => null,
  display: (x: unknown) => x,
  Header: ({ children }: React.PropsWithChildren<{}>) => <div>{children}</div>,
  // The real `load` picks a loader and renders it. A probe is all this spec
  // needs from the success path; the throw stands in for a renderer that cannot
  // handle the data it was given.
  load: (handle: { key: string; version?: string }) => {
    const id = handle.version ? `${handle.key}@${handle.version}` : handle.key
    if (state.throwFor.has(id)) {
      throw new Error(`renderer failed: ${id}`)
    }
    return <div data-testid={`preview:${handle.key}`}>preview:{id}</div>
  },
}))

vi.mock('components/Preview/loaders/summarize', () => ({}))
vi.mock('components/Markdown', () => ({ default: () => null }))
vi.mock('./requests', () => ({
  bucketSummary: () => {},
  ensureObjectIsPresent: () => {},
}))
vi.mock('./errors', () => ({}))
vi.mock('utils/APIConnector', () => ({ use: () => ({}) }))

// Both reads on this path go through `useData`: `bucketSummary` for the entry
// list, then `ensureObjectIsPresent` per entry. The discriminator is `key`,
// which only the per-object head carries.
vi.mock('utils/Data', () => ({
  useData: (_request: unknown, params: { key?: string }) => ({
    case: (cases: Record<string, Function>) =>
      'key' in params ? cases.Ok({ ...params }) : cases.Ok(state.entries),
  }),
}))

import { SummaryRoot } from './Summarize'

const mkFile = (key: string, version?: string) => ({
  handle: { bucket: 'test-bucket', key, version },
  path: key,
})

function renderSummary(keys?: string[]) {
  if (keys) state.entries = keys.map((k) => mkFile(k))
  return render(
    <MemoryRouter>
      <NamedRoutes.Provider routes={{ bucketFile }}>
        <SummaryRoot s3={{} as never} bucket="test-bucket" inStack />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

describe('containers/Bucket/Summarize panel containment', () => {
  beforeEach(() => {
    state.throwFor = new Set()
  })

  afterEach(cleanup)

  // Control, not evidence: proves the harness renders every entry when nothing
  // fails. Passes with or without the fix.
  it('renders every entry when all renderers succeed', () => {
    const { getByTestId } = renderSummary(['a.json', 'b.vega.json', 'c.csv'])

    expect(getByTestId('preview:a.json')).toBeTruthy()
    expect(getByTestId('preview:b.vega.json')).toBeTruthy()
    expect(getByTestId('preview:c.csv')).toBeTruthy()
  })

  it('contains a failing renderer to its own entry', () => {
    state.throwFor = new Set(['b.vega.json'])

    const { getByText, getByTestId, queryByTestId } = renderSummary([
      'a.json',
      'b.vega.json',
      'c.csv',
    ])

    // The entry that failed says so, in place, and names itself -- the boundary
    // replaces the panel heading too, so the title is the only thing left that
    // tells the reader which of several entries failed.
    expect(getByText('Preview unavailable: b.vega.json')).toBeTruthy()
    expect(getByText('renderer failed: b.vega.json')).toBeTruthy()
    expect(queryByTestId('preview:b.vega.json')).toBeNull()

    // ...and its siblings are untouched. This is the assertion that fails
    // without the boundary: the throw escapes and React unmounts the whole
    // tree, taking the summary and the page around it.
    expect(getByTestId('preview:a.json')).toBeTruthy()
    expect(getByTestId('preview:c.csv')).toBeTruthy()
  })

  it('clears a panel error when the same key is served at a new version', () => {
    // `SummaryEntries` keys each row by `handle.key` alone, so a different key
    // remounts the boundary on its own and would pass with no `resetKeys` at
    // all. `version` is absent from that React key: same key, new version is
    // the case where only `resetKeys` clears the previous version's failure
    // rather than showing its error against the new one.
    state.throwFor = new Set(['a.csv@v1'])
    state.entries = [mkFile('a.csv', 'v1')]

    const { getByText, getByTestId, queryByText, rerender } = renderSummary()
    expect(getByText('Preview unavailable: a.csv')).toBeTruthy()

    state.entries = [mkFile('a.csv', 'v2')]
    rerender(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketFile }}>
          <SummaryRoot s3={{} as never} bucket="test-bucket" inStack />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    expect(getByTestId('preview:a.csv')).toBeTruthy()
    expect(queryByText('Preview unavailable')).toBeNull()
  })
})
