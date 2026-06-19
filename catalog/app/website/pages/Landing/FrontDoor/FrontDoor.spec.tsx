import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))
vi.mock('website/components/Backgrounds/Dots', () => ({ default: () => <div /> }))
vi.mock('../Buckets', () => ({ default: () => <div>Existing Buckets fallback</div> }))
vi.mock('./UnifiedBar/UnifiedBar', () => ({
  default: ({ value }: { value: string }) => <div>Unified bar {value}</div>,
}))
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
    expect(
      getByText((_, el) => el?.textContent === 'Find the right data faster'),
    ).toBeTruthy()
    expect(getByText('Buckets tile')).toBeTruthy()
    expect(getByText('Tables tile')).toBeTruthy()
    expect(getByText('Recent tile')).toBeTruthy()
  })

  it('renders the documented content props without error', () => {
    const { getByText } = render(<FrontDoorContent />)
    expect(getByText('Unified bar')).toBeTruthy()
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
