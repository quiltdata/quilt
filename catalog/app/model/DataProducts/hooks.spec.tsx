import * as React from 'react'
import { render, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as Cache from 'utils/ResourceCache'

import { useConnections, useProducts } from './hooks'

// `utils/ResourceCache` is deliberately NOT mocked: the failure mode under test
// is the cache's, not the loader's. It stores a rejected fetch as `AsyncResult
// .Err` and rethrows it on every later read without ever evicting the entry, so
// a loader that rejects blanks the catalog through the root error boundary.

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

const loads = vi.hoisted(() => ({ count: 0 }))

vi.mock('./fixtureAdapter', () => {
  loads.count += 1
  throw new Error('Failed to fetch dynamically imported module')
})

function Products() {
  return <div data-testid="products">{useProducts().length}</div>
}

function Connections() {
  return <div data-testid="connections">{useConnections().length}</div>
}

// No error boundary on purpose: a rethrown rejection fails the render outright
// instead of resolving to a count.
function renderCached(children: React.ReactNode) {
  return render(
    <Cache.Provider>
      <React.Suspense fallback={<div>loading</div>}>{children}</React.Suspense>
    </Cache.Provider>,
  )
}

describe('model/DataProducts/hooks', () => {
  beforeEach(() => {
    loads.count = 0
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('degrades to empty data when the adapter chunk fails to load', async () => {
    renderCached(<Products />)
    await waitFor(() => expect(screen.getByTestId('products').textContent).toBe('0'))
    expect(loads.count).toBe(1)
  })

  it('attempts the import again for a later read', async () => {
    // Separate cache resources, so the second read reaches the loader rather
    // than being served the first entry.
    const { unmount } = renderCached(<Products />)
    await waitFor(() => expect(screen.getByTestId('products').textContent).toBe('0'))
    unmount()

    renderCached(<Connections />)
    await waitFor(() => expect(screen.getByTestId('connections').textContent).toBe('0'))

    // The rejection was not latched: the second read tried the import again.
    expect(loads.count).toBe(2)
  })
})
