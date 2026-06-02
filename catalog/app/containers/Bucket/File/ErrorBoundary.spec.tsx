import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { ErrorBoundary } from 'react-error-boundary'

vi.mock('constants/config', () => ({ default: {} }))

function ThrowingChild({ error }: { error: Error }) {
  throw error
}

describe('containers/Bucket/File ErrorBoundary', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-console
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('renders children when no error is thrown', () => {
    const { getByText } = render(
      <ErrorBoundary fallbackRender={() => <div>fallback</div>}>
        <div>content</div>
      </ErrorBoundary>,
    )
    expect(getByText('content')).toBeTruthy()
  })

  it('renders fallback when a child throws', () => {
    const { getByText } = render(
      <ErrorBoundary fallbackRender={() => <div>Preview unavailable</div>}>
        <ThrowingChild error={new Error('render crash')} />
      </ErrorBoundary>,
    )
    expect(getByText('Preview unavailable')).toBeTruthy()
  })

  it('displays a user-friendly message in the fallback', () => {
    const { getByText } = render(
      <ErrorBoundary
        fallbackRender={() => (
          <div>
            <h2>Preview unavailable</h2>
            <p>Something went wrong loading the preview</p>
          </div>
        )}
      >
        <ThrowingChild error={new Error('boom')} />
      </ErrorBoundary>,
    )
    expect(getByText('Something went wrong loading the preview')).toBeTruthy()
  })
})
