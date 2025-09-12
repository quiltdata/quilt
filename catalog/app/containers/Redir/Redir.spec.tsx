import * as React from 'react'
import { render, act } from '@testing-library/react'

import { bucketPackageTree } from 'constants/routes'
import { createBoundary } from 'utils/ErrorBoundary'
import * as NamedRoutes from 'utils/NamedRoutes'

import Redir from './Redir'

const ErrorBoundary = createBoundary(() => (error: Error) => (
  <span>Error: {error.message}</span>
))

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

jest.mock(
  'components/Layout',
  jest.fn(() => ({ children }: React.PropsWithChildren<{}>) => (
    <div role="main">{children}</div>
  )),
)

const useParams = jest.fn(() => ({ uri: '' }) as Record<string, string>)

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(() => useParams()),
  Redirect: jest.fn(({ to }: { to: string }) => `Redirect to ${to}`),
}))

jest.mock(
  '@material-ui/core',
  jest.fn(() => ({
    ...jest.requireActual('@material-ui/core'),
    Button: jest.fn(({ children, href }: React.PropsWithChildren<{ href: string }>) => (
      <a href={href}>{children}</a>
    )),
  })),
)

describe('containers/Redir/Redir', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementationOnce(jest.fn())
  })

  it('must have uri', () => {
    const { container } = render(
      <ErrorBoundary>
        <Redir />
      </ErrorBoundary>,
    )
    expect(container).toMatchSnapshot()
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
    expect(container).toMatchSnapshot()
  })

  it('shows error', () => {
    useParams.mockImplementationOnce(() => ({
      uri: 'invalid',
    }))
    const { container } = render(<Redir />)
    expect(container).toMatchSnapshot()
  })

  it('redirects to package page', async () => {
    // TODO: spy on window.location.assign
    jest.useFakeTimers()
    useParams.mockImplementation(() => ({
      uri: 'quilt+s3://bucket#package=pkg/name@hash',
    }))
    const { container } = render(
      <NamedRoutes.Provider routes={{ bucketPackageTree }}>
        <Redir />
      </NamedRoutes.Provider>,
    )
    await act(() => jest.runAllTimersAsync())
    expect(container).toMatchSnapshot()
  })
})
