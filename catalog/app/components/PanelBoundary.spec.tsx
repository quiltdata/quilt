import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

import PanelBoundary from './PanelBoundary'

// The call-site specs (Overview.boundary, File.boundary, Assistant/UI/Panel.boundary)
// cover containment through their own pages. These cover what only the shared
// component decides: which chrome each variant gets, and the busy state, so the
// two call sites cannot silently converge on one look.

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

function Boom(): React.ReactElement {
  throw new Error('read failed')
}

describe('components/PanelBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    consoleError.mockRestore()
    vi.clearAllMocks()
  })

  it('keeps the siblings of a throwing child on screen', () => {
    const { getByText, queryByText } = render(
      <>
        <PanelBoundary title="Panel unavailable">
          <Boom />
        </PanelBoundary>
        <div>sibling</div>
      </>,
    )
    expect(getByText('Panel unavailable')).toBeTruthy()
    expect(getByText('read failed')).toBeTruthy()
    expect(queryByText('sibling')).toBeTruthy()
  })

  // `render` exists because a boundary catches only what throws below it.
  it('catches a throw from the render thunk, which children would not', () => {
    const { getByText } = render(
      <PanelBoundary
        title="Panel unavailable"
        render={() => {
          throw new Error('thunk failed')
        }}
      />,
    )
    expect(getByText('thunk failed')).toBeTruthy()
  })

  it('gives the paper variant a card and the plain variant none', () => {
    const { container, rerender } = render(
      <PanelBoundary title="Panel unavailable">
        <Boom />
      </PanelBoundary>,
    )
    expect(container.querySelector('.MuiPaper-outlined')).toBeTruthy()

    rerender(
      <PanelBoundary title="Panel unavailable" variant="plain">
        <Boom />
      </PanelBoundary>,
    )
    expect(container.querySelector('.MuiPaper-outlined')).toBeNull()
  })

  it('lets a call site name its retry', () => {
    const { getByText } = render(
      <PanelBoundary title="Panel unavailable" retryLabel="Clear and retry">
        <Boom />
      </PanelBoundary>,
    )
    expect(getByText('Clear and retry')).toBeTruthy()
  })

  // Reset alone remounts onto the same failure where the state lives above.
  it('runs onRetry and clears the error', () => {
    const onRetry = vi.fn()
    let fail = true
    const Flaky = () => {
      if (fail) throw new Error('transient')
      return <div>recovered</div>
    }
    const { getByText } = render(
      <PanelBoundary title="Panel unavailable" onRetry={onRetry}>
        <Flaky />
      </PanelBoundary>,
    )
    fail = false
    fireEvent.click(getByText('Retry'))
    expect(onRetry).toHaveBeenCalled()
    expect(getByText('recovered')).toBeTruthy()
  })

  it('clears the error when a reset key changes', () => {
    let fail = true
    const Flaky = () => {
      if (fail) throw new Error('transient')
      return <div>recovered</div>
    }
    const { getByText, rerender } = render(
      <PanelBoundary title="Panel unavailable" resetKeys={[0]}>
        <Flaky />
      </PanelBoundary>,
    )
    expect(getByText('transient')).toBeTruthy()
    fail = false
    rerender(
      <PanelBoundary title="Panel unavailable" resetKeys={[1]}>
        <Flaky />
      </PanelBoundary>,
    )
    expect(getByText('recovered')).toBeTruthy()
  })

  // A fresh `onRetry` identity every render is the normal case at the Qurator
  // call site, whose provider hands down an unmemoized object. Rendering the
  // fallback through an element *type* would remount it each time and take focus
  // off the button with it.
  it('keeps the same retry button across an onRetry identity change', () => {
    const { getByText, rerender } = render(
      <PanelBoundary title="Panel unavailable" onRetry={() => {}}>
        <Boom />
      </PanelBoundary>,
    )
    const before = getByText('Retry')
    rerender(
      <PanelBoundary title="Panel unavailable" onRetry={() => {}}>
        <Boom />
      </PanelBoundary>,
    )
    expect(getByText('Retry')).toBe(before)
  })

  describe('while a child suspends', () => {
    const Suspending = () => {
      throw new Promise<void>(() => {})
    }

    // Suspense is unconditional so a call site cannot forget it and let a cold
    // read unwind to the boundary above, replacing the whole page.
    it('contains a suspension even with no placeholder passed', () => {
      const { queryByText } = render(
        <React.Suspense fallback={<div>page-level placeholder</div>}>
          <PanelBoundary title="Panel unavailable">
            <Suspending />
          </PanelBoundary>
          <div>the page</div>
        </React.Suspense>,
      )
      expect(queryByText('page-level placeholder')).toBeNull()
      expect(queryByText('the page')).toBeTruthy()
    })

    it('holds the caller placeholder without announcing a decorative one', () => {
      const { getByText, container } = render(
        <PanelBoundary
          title="Panel unavailable"
          suspenseFallback={<div>placeholder</div>}
        >
          <Suspending />
        </PanelBoundary>,
      )
      expect(getByText('placeholder')).toBeTruthy()
      expect(container.querySelector('[aria-busy]')).toBeNull()
    })

    it('announces the busy state when the caller labels it', () => {
      const { getByText, container } = render(
        <PanelBoundary
          title="Panel unavailable"
          suspenseFallback={<div>placeholder</div>}
          busyLabel="Loading Qurator"
        >
          <Suspending />
        </PanelBoundary>,
      )
      const busy = container.querySelector('[aria-busy]')
      expect(busy).toBeTruthy()
      expect(busy!.getAttribute('aria-live')).toBe('polite')
      expect(getByText('Loading Qurator')).toBeTruthy()
      expect(getByText('placeholder')).toBeTruthy()
    })
  })
})
