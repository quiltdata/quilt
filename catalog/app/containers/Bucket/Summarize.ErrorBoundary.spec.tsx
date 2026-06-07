import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

// Replicate the PreviewErrorBoundary pattern from Summarize.tsx to verify behavior
class PreviewErrorBoundary extends React.Component<
  {
    handle: { bucket: string; key: string; version?: string }
    children: React.ReactNode
  },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getHandleIdentity(handle: { bucket: string; key: string; version?: string }) {
    return `${handle.bucket}/${handle.key}/${handle.version || ''}`
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(
    prevProps: Readonly<{
      handle: { bucket: string; key: string; version?: string }
      children: React.ReactNode
    }>,
  ) {
    if (
      this.state.error &&
      PreviewErrorBoundary.getHandleIdentity(prevProps.handle) !==
        PreviewErrorBoundary.getHandleIdentity(this.props.handle)
    ) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div data-testid="error-fallback">
          <span>{this.props.handle.key}</span>
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
      <PreviewErrorBoundary handle={{ bucket: 'demo', key: 'data/file.csv' }}>
        <div>Preview content</div>
      </PreviewErrorBoundary>,
    )
    expect(getByText('Preview content')).toBeTruthy()
  })

  it('catches errors and renders fallback with file key', () => {
    const { getByText, getByTestId } = render(
      <PreviewErrorBoundary handle={{ bucket: 'demo', key: 'data/broken.pdf' }}>
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
        <PreviewErrorBoundary handle={{ bucket: 'demo', key: 'good.csv' }}>
          <div>Good preview</div>
        </PreviewErrorBoundary>
        <PreviewErrorBoundary handle={{ bucket: 'demo', key: 'bad.pdf' }}>
          <ThrowingChild error={new Error('crash')} />
        </PreviewErrorBoundary>
      </div>,
    )
    expect(getByText('Good preview')).toBeTruthy()
    expect(getByText('Preview unavailable')).toBeTruthy()
    expect(queryByText('Good preview')).toBeTruthy()
  })

  it('resets the fallback when the handle version changes', () => {
    const { getByText, queryByTestId, rerender } = render(
      <PreviewErrorBoundary
        handle={{ bucket: 'demo', key: 'data/file.csv', version: '1' }}
      >
        <ThrowingChild error={new Error('crash')} />
      </PreviewErrorBoundary>,
    )

    expect(getByText('Preview unavailable')).toBeTruthy()

    rerender(
      <PreviewErrorBoundary
        handle={{ bucket: 'demo', key: 'data/file.csv', version: '2' }}
      >
        <div>Recovered preview</div>
      </PreviewErrorBoundary>,
    )

    expect(queryByTestId('error-fallback')).toBeNull()
    expect(getByText('Recovered preview')).toBeTruthy()
  })
})
