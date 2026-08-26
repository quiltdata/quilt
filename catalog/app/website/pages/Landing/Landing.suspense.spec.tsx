import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as Cache from 'utils/ResourceCache'

// `utils/ResourceCache` and `utils/CatalogSettings` are deliberately NOT mocked.
// The mechanism under test lives in the cache itself: `init` creates an entry in
// `AsyncResult.Init` and defers the fetch with `setTimeout(..., 0)`, and
// `suspend` throws the pending promise for `Init` as well as `Pending`
// (ResourceCache.jsx:130, :155). So the *first* read of the settings entry
// suspends no matter what the fetch does -- including in LOCAL mode, where
// `fetchSettings` short-circuits to null before touching S3
// (CatalogSettings.tsx:62). A mocked cache returning synchronously would hide
// exactly that, and every assertion here would pass for the wrong reason.

const mode = vi.hoisted(() => ({ current: 'FULL' as 'FULL' | 'LOCAL' }))
// Real settings fetches, so LOCAL can be checked for network it should skip.
const fetches = vi.hoisted(() => ({ current: 0 }))

vi.mock('constants/config', () => ({
  get default() {
    return { mode: mode.current, serviceBucket: 'service-bucket' }
  },
}))

// One stable client instance, not a fresh object per call. `useData` memoizes
// its input through `useMemoEq`/`R.equals`, which compares `getObject` by
// reference, so a new client each render changes the memo key, re-runs the
// effect, calls `setEntry`, and re-renders -- an infinite loop that hangs the
// run rather than failing it.
vi.mock('utils/AWS', () => {
  const s3 = {
    getObject: () => ({
      promise: async () => {
        fetches.current += 1
        return { Body: Buffer.from('{}') }
      },
    }),
  }
  return { S3: { use: () => s3 } }
})

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

// The three destinations, as markers. Which one renders is the whole output of
// the component under test.
vi.mock('./FrontDoor', () => ({ default: () => <div>Front door</div> }))
vi.mock('./LocalMode', () => ({ default: () => <div>Local mode</div> }))
vi.mock('containers/Home/Buckets', () => ({ default: () => <div>Volume list</div> }))
vi.mock('utils/MetaTitle', () => ({ default: () => null }))

// Whether the Layout stub's rail reads settings, so the page's own read can be
// isolated from the rail's.
const railReads = vi.hoisted(() => ({ current: true }))

// Mirrors the real Layout's ordering for the purposes of the claim under test:
// `components/Layout/Layout.tsx:126-134` renders `<Sidebar />` and then the page
// content as siblings, with no Suspense boundary between them, and
// `Sidebar.tsx:372` reads CatalogSettings unconditionally in every mode. The
// real Layout drags in GraphQL, redux and the whole nav; this keeps the ordering
// and drops the weight.
vi.mock('website/components/Layout', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div>
      <Rail />
      {children}
    </div>
  ),
}))

import * as CatalogSettings from 'utils/CatalogSettings'

const rail = { reads: 0, renders: 0 }

// The reading and silent rails are separate components, and `Rail` picks between
// them without calling any hook itself. One component with an early return above
// `use()` would be a real rules-of-hooks violation -- the same class of mistake
// this spec exists to measure, so it should not appear in the harness either.
function ReadingRail() {
  rail.reads += 1
  CatalogSettings.use()
  rail.renders += 1
  return <div>Rail</div>
}

function SilentRail() {
  return <div>Rail</div>
}

function Rail() {
  const Component = railReads.current ? ReadingRail : SilentRail
  return <Component />
}

import Landing from './Landing'

// The boundaries that actually exist above this page: `mkLazy`'s, wrapping the
// Landing route (containers/App/App.jsx:83), and the global one (app.tsx:101).
// Both sit above the whole Layout, so anything unwinding this far replaces the
// entire page -- rail included -- with the app placeholder.
function renderAt(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <Cache.Provider>
        <React.Suspense fallback={<div>App-level placeholder</div>}>{ui}</React.Suspense>
      </Cache.Provider>
    </MemoryRouter>,
  )
}

// The cache defers its fetch a macrotask and then resolves through promise
// callbacks, so letting an entry land takes several interleaved ticks. Inside
// `act` so React's resulting re-render is flushed before any assertion runs.
async function settle() {
  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

beforeEach(() => {
  mode.current = 'FULL'
  railReads.current = true
  fetches.current = 0
  rail.reads = 0
  rail.renders = 0
})

afterEach(cleanup)

describe('website/pages/Landing LOCAL mode', () => {
  // The sharpest form of the bug, and the assertion that fails against the
  // unfixed component. LOCAL mode has no service bucket and no settings
  // document, and its page is a static marketing panel -- but reading the
  // feature flag above the LOCAL early return put that panel behind a
  // suspending cache read anyway. The rail is silenced here so this measures the
  // page's OWN read and nothing else.
  it('renders the static panel without a suspending settings read', () => {
    mode.current = 'LOCAL'
    railReads.current = false

    const { queryByText } = renderAt(<Landing />)

    expect(queryByText('Local mode')).not.toBeNull()
    expect(queryByText('App-level placeholder')).toBeNull()
  })

  // LOCAL never had settings to fetch, so the suspension bought nothing even
  // while it lasted: `fetchSettings` returns null before it touches S3. True
  // before and after the fix -- it is here to show the wait was pure cost, not
  // to prove the fix.
  it('fetches no settings document in LOCAL mode (control)', async () => {
    mode.current = 'LOCAL'
    railReads.current = false

    renderAt(<Landing />)
    await settle()

    expect(fetches.current).toBe(0)
  })
})

describe('website/pages/Landing cold-cache suspension', () => {
  // What the comment on the flag read claimed: the read "adds no wait here"
  // because the enclosing Layout renders the Sidebar, "which already reads the
  // same CatalogSettings cache entry".
  //
  // Measured: the conclusion holds, but not for the stated reason. The rail does
  // not warm the entry for its sibling -- it CREATES the entry in `Init` and
  // throws, so it suspends first and the page below it is never reached on the
  // cold pass. The whole page, rail included, is replaced.
  it('is replaced by the app placeholder on a cold cache, rail first', () => {
    const { queryByText } = renderAt(<Landing />)

    // The rail read and did not get a value: the entry is Init, not Ok.
    expect(rail.reads).toBe(1)
    expect(rail.renders).toBe(0)
    expect(queryByText('App-level placeholder')).not.toBeNull()
    expect(queryByText('Rail')).toBeNull()
    expect(queryByText('Volume list')).toBeNull()
  })

  // The other half: a page that reads no flag at all still ends up behind the
  // placeholder, because the rail's read is what unwinds the subtree. That is
  // what makes "adds no wait here" true -- and also what makes it INCIDENTAL: it
  // is a fact about the rail, not about this page. Move the rail's read (or give
  // it a boundary) and the page's own read becomes the thing that suspends.
  //
  // Asserted on the placeholder rather than on the absence of the page's text:
  // React 17's legacy Suspense commits an already-rendered sibling in a hidden
  // subtree instead of dropping it, so the flagless page's text is still in the
  // DOM behind the fallback.
  it('shows the placeholder even for a page that reads no flag', () => {
    function FlaglessPage() {
      return <div>Flagless page</div>
    }
    const { queryByText } = renderAt(
      <div>
        <Rail />
        <FlaglessPage />
      </div>,
    )

    expect(rail.reads).toBe(1)
    expect(rail.renders).toBe(0)
    expect(queryByText('App-level placeholder')).not.toBeNull()
  })

  // Once the entry resolves, both reads are synchronous and the flag-off
  // destination renders. True after a page-replacing placeholder, not instead
  // of one.
  it('resolves into the volume list with the rail intact', async () => {
    const { queryByText } = renderAt(<Landing />)
    await settle()

    expect(queryByText('App-level placeholder')).toBeNull()
    expect(queryByText('Rail')).not.toBeNull()
    expect(queryByText('Volume list')).not.toBeNull()
    expect(rail.renders).toBeGreaterThan(0)
  })
})
