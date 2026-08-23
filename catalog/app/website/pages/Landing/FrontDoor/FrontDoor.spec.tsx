import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))
vi.mock('containers/Home/Buckets', () => ({
  default: () => <div>Existing Buckets fallback</div>,
}))
vi.mock('./UnifiedBar/UnifiedBar', () => ({
  default: ({ value }: { value: string }) => <div>Unified bar {value}</div>,
}))
vi.mock('./ExampleQueries', () => ({ default: () => <div>Example queries</div> }))
vi.mock('./Tiles/BucketsTile', () => ({ default: () => <div>Buckets tile</div> }))
vi.mock('./Tiles/TablesTile', () => ({ default: () => <div>Tables tile</div> }))
vi.mock('./Tiles/RecentPackagesTile', () => ({ default: () => <div>Recent tile</div> }))

import FrontDoor, { FrontDoorContent, TileBoundary } from './FrontDoor'

function Thrower(): JSX.Element {
  throw new Error('boom')
}

describe('website/pages/Landing/FrontDoor/FrontDoor', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    consoleError.mockRestore()
  })

  it('renders the front-door shell without error', () => {
    const { getByText } = render(<FrontDoor />)
    expect(getByText('What are you looking for?')).toBeTruthy()
    expect(getByText('Buckets tile')).toBeTruthy()
    expect(getByText('Tables tile')).toBeTruthy()
    expect(getByText('Recent tile')).toBeTruthy()
  })

  it('renders the documented content props without error', () => {
    const { getByText } = render(<FrontDoorContent />)
    expect(getByText('Unified bar')).toBeTruthy()
  })

  // The end-to-end canaries wait on this hook to know login landed on a working
  // landing page (quiltdata/e2e `shared/auth.ts`, `waitForHomePage`). The volume
  // list carries the same one, so the check does not care which side of the
  // `front-door` flag a stack is on -- and neither page's visible wording is
  // pinned by it, which is what broke last time.
  it('marks the greeting as the landing-page anchor the canaries wait on', () => {
    const { getByTestId } = render(<FrontDoor />)

    const anchor = getByTestId('landing-heading')
    expect(anchor.tagName).toBe('H1')
    expect(anchor.textContent).toBe('What are you looking for?')
  })

  it('collapses a single failing tile without removing the rest of the page', () => {
    const { getByText } = render(
      <div>
        <TileBoundary>
          <Thrower />
        </TileBoundary>
        <div>Sibling tile still renders</div>
      </div>,
    )
    expect(getByText('Tile unavailable')).toBeTruthy()
    expect(getByText('Sibling tile still renders')).toBeTruthy()
  })
})
