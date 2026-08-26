import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

import Overview from './Overview'

// Containment specs for the Overview's panel boundaries.
//
// Both `Header` and `Summaries` read BUCKET_QUERY through `GQL.useQueryS`, which
// *throws* on error. With no boundary between them and `Errors.ErrorBoundary` in
// app.tsx, either failure replaced the entire catalog with the app-level error
// screen -- for what is usually a routine permission or network problem on one
// panel. These tests make one panel's data source fail and assert the others
// still render.
//
// Note the other Overview specs (Header.spec, Summaries via TabulatorTables.spec)
// mock `utils/GraphQL` into a *successful* read, so none of them could ever
// observe this. These mock it at the same seam but let it throw.

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useParams: () => ({ bucket: 'test-bucket' }),
}))

// Each panel is identified by a probe so we can assert survival precisely.
// Header and Summaries call useQueryS themselves; the mocks below decide whether
// that read throws, per panel.
const headerQuery = vi.fn<() => unknown>()
const summariesQuery = vi.fn<() => unknown>()

vi.mock('./Header', () => ({
  default: ({ bucket }: { bucket: string }) => {
    headerQuery()
    return <div data-testid="header">header:{bucket}</div>
  },
}))

vi.mock('./Summaries', () => ({
  default: ({ bucket }: { bucket: string }) => {
    summariesQuery()
    return <div data-testid="summaries">summaries:{bucket}</div>
  },
}))

vi.mock('./TabulatorTables', () => ({
  default: () => <div data-testid="tabulator">tabulator</div>,
}))

function renderOverview() {
  return render(
    <MemoryRouter>
      <Overview />
    </MemoryRouter>,
  )
}

describe('containers/Bucket/Overview/v2/Overview panel containment', () => {
  beforeEach(() => {
    headerQuery.mockReturnValue(undefined)
    summariesQuery.mockReturnValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // Control, not evidence: proves the harness renders all three panels when
  // nothing fails. Passes with or without the fix.
  it('renders every panel when all reads succeed', () => {
    const { getByTestId } = renderOverview()
    expect(getByTestId('header')).toBeTruthy()
    expect(getByTestId('tabulator')).toBeTruthy()
    expect(getByTestId('summaries')).toBeTruthy()
  })

  it('contains a failing Header read to its own panel', () => {
    headerQuery.mockImplementation(() => {
      throw new Error('BUCKET_QUERY failed')
    })

    const { getByText, getByTestId, queryByTestId } = renderOverview()

    // The panel that failed says so, in place.
    expect(getByText('Bucket overview unavailable')).toBeTruthy()
    expect(getByText('BUCKET_QUERY failed')).toBeTruthy()
    expect(queryByTestId('header')).toBeNull()

    // ...and the rest of the page is untouched. This is the assertion that
    // fails without the boundary: the throw escapes and React unmounts the
    // whole tree.
    expect(getByTestId('tabulator')).toBeTruthy()
    expect(getByTestId('summaries')).toBeTruthy()
  })

  it('contains a failing Summaries read to its own panel', () => {
    summariesQuery.mockImplementation(() => {
      throw new Error('summarize read failed')
    })

    const { getByText, getByTestId, queryByTestId } = renderOverview()

    expect(getByText('Summaries unavailable')).toBeTruthy()
    expect(queryByTestId('summaries')).toBeNull()

    expect(getByTestId('header')).toBeTruthy()
    expect(getByTestId('tabulator')).toBeTruthy()
  })

  it('offers a retry that remounts the failed panel', () => {
    let fail = true
    headerQuery.mockImplementation(() => {
      if (fail) throw new Error('transient')
    })

    const { getByText, getByTestId, queryByTestId } = renderOverview()
    expect(queryByTestId('header')).toBeNull()

    // urql does not cache failures, so for `useQueryS` panels a plain
    // `resetErrorBoundary` is a live affordance: remounting re-reads.
    fail = false
    fireEvent.click(getByText('Retry'))

    expect(getByTestId('header')).toBeTruthy()
    expect(queryByTestId('header')!.textContent).toBe('header:test-bucket')
  })

  it('holds a panel placeholder while a panel suspends, without unmounting siblings', () => {
    // An ErrorBoundary does not catch suspension. Without the Suspense inside
    // each PanelBoundary, a cold read unwinds to mkLazy's boundary above and
    // replaces the whole page with its placeholder.
    let resolve = () => {}
    const pending = new Promise<void>((res) => {
      resolve = res
    })
    headerQuery.mockImplementation(() => {
      throw pending
    })

    const { getByTestId, queryByTestId } = renderOverview()

    expect(queryByTestId('header')).toBeNull()
    expect(getByTestId('tabulator')).toBeTruthy()
    expect(getByTestId('summaries')).toBeTruthy()

    resolve()
  })
})
