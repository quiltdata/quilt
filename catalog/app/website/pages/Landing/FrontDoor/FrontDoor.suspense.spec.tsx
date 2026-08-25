import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

// This regression shipped *because* every other front-door spec mocks
// `utils/Buckets` away: mocked, the hook returns synchronously and the
// suspension that breaks the page in production never happens in the suite. So
// this file deliberately leaves `utils/Buckets` alone and drives the suspension
// from underneath it, at the GraphQL layer -- the same place a real cold cache
// suspends.
vi.mock('constants/config', () => ({ default: {} }))
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

// `utils/Buckets` reads the auth flag through redux; nothing here exercises auth.
vi.mock('react-redux', () => ({ useSelector: () => false }))

type Mode = 'suspend' | 'resolved'

const mode = vi.hoisted(() => ({ current: 'suspend' as Mode }))
const pending = vi.hoisted(() => ({ current: null as Promise<void> | null }))
const release = vi.hoisted(() => ({ current: () => {} }))
const suspends = vi.hoisted(() => ({ current: 0 }))

// A cold-cache `useQueryS`: throws a promise (i.e. suspends) until the data
// lands, exactly as urql's suspense mode does. `Paused` has to exist because
// utils/Buckets catches it by identity.
vi.mock('utils/GraphQL', () => ({
  Paused: class Paused extends Error {},
  useQueryS: () => {
    if (mode.current === 'resolved') return { buckets: [] }
    if (!pending.current) {
      suspends.current += 1
      pending.current = new Promise<void>((resolve) => {
        release.current = () => {
          mode.current = 'resolved'
          resolve()
        }
      })
    }
    throw pending.current
  },
  useQuery: () => ({ data: undefined, fetching: true }),
  fold: (result: unknown, cases: { fetching: (r: unknown) => unknown }) =>
    cases.fetching(result),
}))

// Not under test here: the chips and tiles do their own reads, and leaving them
// live would suspend for reasons unrelated to the bar.
vi.mock('./ExampleQueries', () => ({ default: () => <div>Example queries</div> }))
vi.mock('./Tiles/BucketsTile', () => ({ default: () => <div>Buckets tile</div> }))
vi.mock('./Tiles/TablesTile', () => ({ default: () => <div>Tables tile</div> }))
vi.mock('./Tiles/RecentPackagesTile', () => ({ default: () => <div>Recent tile</div> }))
// The suggestion rows themselves aren't the point; the bucket read beside them is.
vi.mock('./useUnifiedSuggestions', () => ({ default: () => [] }))
vi.mock('components/Assistant', () => ({
  Model: { useIsEnabled: () => false, useAssistant: () => vi.fn() },
}))

import { FrontDoorContent, TileBoundary } from './FrontDoor'

const FIELD = 'Search or ask Qurator'

// Stands in for the boundaries that actually exist above this page: `mkLazy`'s
// (wrapping the whole Landing route) and the global one in app.tsx. Both sit
// ABOVE the component that owns `query`, so anything that unwinds this far
// remounts the page and takes the typed text with it. The fallback is named so a
// test can prove the page was replaced rather than merely re-rendered.
function renderPage() {
  return render(
    <MemoryRouter>
      <M.MuiThemeProvider theme={style.appTheme}>
        <React.Suspense fallback={<div>App-level placeholder</div>}>
          <FrontDoorContent />
        </React.Suspense>
      </M.MuiThemeProvider>
    </MemoryRouter>,
  )
}

describe('website/pages/Landing/FrontDoor cold-cache suspension', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mode.current = 'suspend'
    pending.current = null
    suspends.current = 0
  })

  afterEach(() => {
    cleanup()
    consoleError.mockRestore()
  })

  // Note on the mechanism: `classifyQuery('')` returns 'Search', so
  // SearchSuggestions -- and its always-suspending `useRelevantBuckets` read --
  // mounts on page LOAD, not first on a keystroke. With no boundary below the
  // state holder, that load-time suspension unwound all the way to a boundary
  // above `FrontDoorContent`, so a cold visit replaced the entire front door
  // with the app placeholder: an unusable page until buckets resolved.
  it('keeps the field usable while the bucket read is in flight on a cold load', () => {
    const { queryByText, queryByLabelText } = renderPage()

    // The read really is in flight -- otherwise this test would pass for the
    // wrong reason, which is exactly how the defect stayed invisible.
    expect(suspends.current).toBe(1)
    expect(queryByText('App-level placeholder')).toBeNull()
    expect(queryByLabelText(FIELD)).toBeTruthy()
    // The page around the bar is intact too, not swapped for a placeholder.
    expect(queryByText('What are you looking for?')).toBeTruthy()
  })

  it('does not announce the loading placeholder as a listbox', () => {
    const { queryByRole, getByLabelText } = renderPage()
    // The field claims the popup is closed while the rows are in flight, so
    // announcing skeletons as options would contradict `aria-expanded`.
    expect(getByLabelText(FIELD).getAttribute('aria-expanded')).toBe('false')
    expect(queryByRole('listbox')).toBeNull()
  })

  // The text-loss case. A suspension that lands *after* the field is
  // interactive is reachable in production through the `pause` transition in
  // utils/Buckets: while `alwaysRequiresAuth && !authenticated` the query is
  // paused and returns EMPTY synchronously, and it only starts suspending once
  // auth resolves -- which can happen mid-typing. Wherever it comes from, the
  // boundary's job is to contain it below the state that holds the query.
  it('keeps typed text when a suspension lands after the field is interactive', () => {
    mode.current = 'resolved'
    const { getByLabelText, queryByText } = renderPage()
    expect(suspends.current).toBe(0)

    const input = getByLabelText(FIELD) as HTMLInputElement
    input.focus()
    // Now the read goes cold under the user, and a keystroke re-enters it.
    mode.current = 'suspend'
    fireEvent.change(input, { target: { value: 'drugbank' } })

    expect(suspends.current).toBe(1)
    expect(queryByText('App-level placeholder')).toBeNull()
    // The whole point: the query lives in FrontDoorContent, above the read but
    // below the boundary, so it survives.
    expect((getByLabelText(FIELD) as HTMLInputElement).value).toBe('drugbank')
    // The boundary sits below the Input rather than around the whole bar so the
    // field is never unmounted -- otherwise focus and caret go with it even
    // though the value stayed.
    expect(document.activeElement).toBe(getByLabelText(FIELD))
  })

  it('resolves into the real suggestions list with the query intact', async () => {
    const { getByLabelText, queryByText } = renderPage()
    fireEvent.change(getByLabelText(FIELD), { target: { value: 'drugbank' } })

    release.current()
    await waitFor(() => expect(getByLabelText(FIELD)).toBeTruthy())
    await waitFor(() => expect(document.querySelector('[role="listbox"]')).toBeTruthy())

    expect(queryByText('App-level placeholder')).toBeNull()
    expect((getByLabelText(FIELD) as HTMLInputElement).value).toBe('drugbank')
    // The scope rows the resolved list is supposed to draw.
    expect(queryByText('packages')).toBeTruthy()
  })

  // TileBoundary is an *error* boundary; an ErrorBoundary does not catch
  // suspension. Without a Suspense inside it, a tile's cold read unwinds past it
  // to a boundary above FrontDoorContent -- same page-replacing outcome.
  it('contains a suspending tile without replacing the page', () => {
    // Never resolves: this asserts what is on screen *while* the read is in
    // flight, which is the whole window in which the page used to disappear.
    const tilePending = new Promise<void>(() => {})
    function SuspendingTile(): JSX.Element {
      throw tilePending
    }

    const { queryByText } = render(
      <M.MuiThemeProvider theme={style.appTheme}>
        <React.Suspense fallback={<div>App-level placeholder</div>}>
          <div>
            <TileBoundary>
              <SuspendingTile />
            </TileBoundary>
            <div>Sibling tile still renders</div>
          </div>
        </React.Suspense>
      </M.MuiThemeProvider>,
    )

    expect(queryByText('App-level placeholder')).toBeNull()
    expect(queryByText('Sibling tile still renders')).toBeTruthy()
  })
})
