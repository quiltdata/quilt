import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { render, act } from '@testing-library/react'
import { vi } from 'vitest'

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
    const { container } = render(
      <ErrorBoundary FallbackComponent={FallbackComponent}>
        <Redir />
      </ErrorBoundary>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('shows waiting screen', () => {
    useParams.mockImplementationOnce(() => ({
      uri: 'quilt+s3://bucket#package=pkg/name@hash',
    }))
    const { container } = render(
      <NamedRoutes.Provider routes={{ bucketPackageTree }}>
        <Redir />
      </NamedRoutes.Provider>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('shows error', () => {
    useParams.mockImplementationOnce(() => ({
      uri: 'invalid',
    }))
    const { container } = render(<Redir />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('redirects to package page', async () => {
    // TODO: spy on window.location.assign
    vi.useFakeTimers()
    useParams.mockImplementation(() => ({
      uri: 'quilt+s3://bucket#package=pkg/name@hash',
    }))
    const { container } = render(
      <NamedRoutes.Provider routes={{ bucketPackageTree }}>
        <Redir />
      </NamedRoutes.Provider>,
    )
    await act(() => vi.runAllTimersAsync())
    expect(container.firstChild).toMatchSnapshot()
    vi.useRealTimers()
  })
})
