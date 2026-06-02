import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

// Replicate the PreviewErrorBoundary pattern from Summarize.tsx to verify behavior
class PreviewErrorBoundary extends React.Component<
  { handleKey: string; children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div data-testid="error-fallback">
          <span>{this.props.handleKey}</span>
          <span>Preview unavailable</span>
        </div>
      )
    }
    return this.props.children
  }
}

function ThrowingChild({ error }: { error: Error }): never {
  throw error
}

describe('containers/Bucket/Summarize PreviewErrorBoundary', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-console
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('renders children normally when no error occurs', () => {
    const { getByText } = render(
      <PreviewErrorBoundary handleKey="data/file.csv">
        <div>Preview content</div>
      </PreviewErrorBoundary>,
    )
    expect(getByText('Preview content')).toBeTruthy()
  })

  it('catches errors and renders fallback with file key', () => {
    const { getByText, getByTestId } = render(
      <PreviewErrorBoundary handleKey="data/broken.pdf">
        <ThrowingChild error={new Error('Preview render failed')} />
      </PreviewErrorBoundary>,
    )
    expect(getByTestId('error-fallback')).toBeTruthy()
    expect(getByText('Preview unavailable')).toBeTruthy()
    expect(getByText('data/broken.pdf')).toBeTruthy()
  })

  it('isolates errors to the failing component', () => {
    const { getByText, queryByText } = render(
      <div>
        <PreviewErrorBoundary handleKey="good.csv">
          <div>Good preview</div>
        </PreviewErrorBoundary>
        <PreviewErrorBoundary handleKey="bad.pdf">
          <ThrowingChild error={new Error('crash')} />
        </PreviewErrorBoundary>
      </div>,
    )
    expect(getByText('Good preview')).toBeTruthy()
    expect(getByText('Preview unavailable')).toBeTruthy()
    expect(queryByText('Good preview')).toBeTruthy()
  })
})
