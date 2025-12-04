import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { render, act } from '@testing-library/react'
import { expect, beforeEach, describe, it, vi } from 'vitest'

import { bucketPackageTree } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import Redir from './Redir'

const FallbackComponent = ({ error }: FallbackProps) => (
  <span>Error: {error.message}</span>
)

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/Layout', () => ({
  default: ({ children }: React.PropsWithChildren<{}>) => (
    <div role="main">{children}</div>
  ),
}))

const useParams = vi.fn(() => ({ uri: '' }) as Record<string, string>)

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn(() => useParams()),
    Redirect: vi.fn(({ to }: { to: string }) => `Redirect to ${to}`),
  }
})

vi.mock('@material-ui/core', async () => {
  const actual = await vi.importActual('@material-ui/core')
  return {
    ...actual,
    Button: vi.fn(({ children, href }: React.PropsWithChildren<{ href: string }>) => (
      <a href={href}>{children}</a>
    )),
  }
})

describe('containers/Redir/Redir', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(vi.fn())
  })

  it('must have uri', () => {
    const errorHandler = vi.fn((event) => event.preventDefault())
    window.addEventListener('error', errorHandler)

    const { container } = render(
      <ErrorBoundary FallbackComponent={FallbackComponent}>
        <Redir />
      </ErrorBoundary>,
    )

    expect(container.firstChild).toMatchSnapshot()

    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('`uri` must be defined'),
        }),
      }),
    )

    window.removeEventListener('error', errorHandler)
  })

  it('shows waiting screen', () => {
    // Mock window.location.assign to prevent jsdom navigation error
    const locationAssignSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { assign: locationAssignSpy },
      writable: true,
    })

    useParams.mockImplementationOnce(() => ({
      uri: 'quilt+s3://bucket#package=pkg/name@hash',
    }))
    const { container } = render(
      <NamedRoutes.Provider routes={{ bucketPackageTree }}>
        <Redir />
      </NamedRoutes.Provider>,
    )
    expect(container.firstChild).toMatchSnapshot()

    // Verify that location.assign is eventually called (navigation happens)
    expect(locationAssignSpy).toHaveBeenCalledTimes(1)
    expect(locationAssignSpy).toHaveBeenCalledWith(expect.stringContaining('bucket'))
  })

  it('shows error', () => {
    useParams.mockImplementationOnce(() => ({
      uri: 'invalid',
    }))
    const { container } = render(<Redir />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('redirects to package page', async () => {
    // Mock window.location.assign to prevent jsdom "Not implemented: navigation" error
    const locationAssignSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { assign: locationAssignSpy },
      writable: true,
    })

    vi.useFakeTimers()
    useParams.mockImplementation(() => ({
      uri: 'quilt+s3://bucket#package=pkg/name@hash',
    }))
    const { container } = render(
      <NamedRoutes.Provider routes={{ bucketPackageTree }}>
        <Redir />
      </NamedRoutes.Provider>,
    )
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(container.firstChild).toMatchSnapshot()

    // Verify that location.assign was called (redirect occurred)
    expect(locationAssignSpy).toHaveBeenCalledTimes(1)
    expect(locationAssignSpy).toHaveBeenCalledWith(expect.stringContaining('bucket'))

    vi.useRealTimers()
  })
})
