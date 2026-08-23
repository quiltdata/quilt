import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

// The volume list stands in for "the data path that just failed". The page-level
// fallback used to mount this component, which reads the same GraphQL the front
// door does (useIsAdmin + useRelevantBuckets) -- so when the front door failed
// BECAUSE GraphQL was unreachable, the fallback threw on its own render.
// react-error-boundary builds its fallback element inside its own render pass and
// therefore cannot catch that, so it escalated to the app-level boundary: the
// full error page, which is precisely what this boundary exists to prevent.
//
// Throwing here models the unreachable-GraphQL case. A fallback that does not
// touch this path never calls the mock at all.
const bucketsRendered = vi.hoisted(() => ({ current: 0 }))
vi.mock('containers/Home/Buckets', () => ({
  default: () => {
    bucketsRendered.current += 1
    throw new Error('GraphQL unreachable')
  },
}))

vi.mock('./UnifiedBar/UnifiedBar', () => ({
  default: ({ value }: { value: string }) => <div>Unified bar {value}</div>,
}))
vi.mock('./ExampleQueries', () => ({ default: () => <div>Example queries</div> }))
vi.mock('./Tiles/BucketsTile', () => ({ default: () => <div>Buckets tile</div> }))
vi.mock('./Tiles/TablesTile', () => ({ default: () => <div>Tables tile</div> }))
vi.mock('./Tiles/RecentPackagesTile', () => ({ default: () => <div>Recent tile</div> }))

import { PageBoundary } from './FrontDoor'

function Thrower(): JSX.Element {
  throw new Error('front door exploded')
}

// Stands in for Errors.ErrorBoundary at app.tsx: the app-level boundary the
// escaping error landed on. If this renders, the user is looking at the full-app
// error page instead of the page-level fallback.
function renderFailingPage(children: React.ReactNode = <Thrower />) {
  return render(
    <MemoryRouter>
      <M.MuiThemeProvider theme={style.appTheme}>
        <ErrorBoundary fallback={<div>App-level error page</div>}>
          <PageBoundary>{children}</PageBoundary>
        </ErrorBoundary>
      </M.MuiThemeProvider>
    </MemoryRouter>,
  )
}

describe('website/pages/Landing/FrontDoor page-level fallback', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    bucketsRendered.current = 0
  })

  afterEach(() => {
    cleanup()
    consoleError.mockRestore()
  })

  it('renders its own fallback instead of escalating to the app error page', () => {
    const { queryByText } = renderFailingPage()

    // The defect: with the fallback mounting the volume list, this assertion
    // failed -- the throw inside the fallback escaped to the app boundary.
    expect(queryByText('App-level error page')).toBeNull()
    expect(queryByText('This page could not be loaded')).toBeTruthy()
  })

  // The fallback has an `h1` of its own, and it must not wear the canaries'
  // landing-page hook. `waitForHomePage` (quiltdata/e2e `shared/auth.ts`) treats
  // that hook as "login landed on a working page"; if the error state carried it,
  // a front door that failed to render would report as a healthy login and the
  // canaries would go green on a broken catalog. The whole point of a synthetic
  // check is that it cannot be satisfied by the failure it exists to catch.
  it('does not claim the landing-page anchor for its error state', () => {
    const { queryByTestId, queryByText } = renderFailingPage()

    expect(queryByText('This page could not be loaded')).toBeTruthy()
    expect(queryByTestId('landing-heading')).toBeNull()
  })

  it('does not re-enter the data path that failed', () => {
    renderFailingPage()
    // The whole point. A fallback that reads the same GraphQL as the page it is
    // standing in for cannot be trusted to render when that GraphQL is why the
    // page failed.
    expect(bucketsRendered.current).toBe(0)
  })

  it('offers a retry that clears the error and remounts the page', () => {
    // Fails once, then succeeds -- so a working retry is observable.
    let shouldThrow = true
    function FlakyPage(): JSX.Element {
      if (shouldThrow) throw new Error('front door exploded')
      return <div>Front door recovered</div>
    }

    const { getByText, queryByText } = renderFailingPage(<FlakyPage />)
    expect(queryByText('This page could not be loaded')).toBeTruthy()

    shouldThrow = false
    // Without `resetErrorBoundary` wired to a control, the only way back was a
    // full reload -- so one failure made the flag read as off for the rest of
    // the session.
    fireEvent.click(getByText('Try again'))

    expect(queryByText('This page could not be loaded')).toBeNull()
    expect(queryByText('Front door recovered')).toBeTruthy()
  })

  it('still points at the volume list, as a link rather than a mount', () => {
    const { getByText } = renderFailingPage()
    // The promise the original comment made -- the thing the front door replaced
    // still works -- kept without depending on the data that just failed.
    const link = getByText('Browse volumes').closest('a')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('/buckets')
  })

  it('surfaces the failure message rather than swallowing it', () => {
    const { queryByText } = renderFailingPage()
    expect(queryByText('front door exploded')).toBeTruthy()
  })
})
