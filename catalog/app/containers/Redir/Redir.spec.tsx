import * as React from 'react'
import renderer from 'react-test-renderer'

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
  it('must have uri', () => {
    jest.spyOn(console, 'error').mockImplementationOnce(jest.fn())
    const tree = renderer.create(
      <ErrorBoundary>
        <Redir />
      </ErrorBoundary>,
    )
    expect(tree).toMatchSnapshot()
  })

  it('shows waiting screen', () => {
    // TODO: spy on window.location.assign
    jest.spyOn(console, 'error').mockImplementationOnce(jest.fn())
    useParams.mockImplementationOnce(() => ({
      uri: 'quilt+s3://bucket#package=pkg/name@hash',
    }))
    const tree = renderer.create(
      <NamedRoutes.Provider routes={{ bucketPackageTree }}>
        <Redir />
      </NamedRoutes.Provider>,
    )
    expect(tree).toMatchSnapshot()
  })

  it('shows error', () => {
    useParams.mockImplementationOnce(() => ({
      uri: 'invalid',
    }))
    const tree = renderer.create(<Redir />)
    expect(tree).toMatchSnapshot()
  })

  it('redirects to package page', async () => {
    // TODO: spy on window.location.assign
    jest.spyOn(console, 'error').mockImplementationOnce(jest.fn())
    useParams.mockImplementation(() => ({
      uri: 'quilt+s3://bucket#package=pkg/name@hash',
    }))
    const tree = renderer.create(
      <NamedRoutes.Provider routes={{ bucketPackageTree }}>
        <Redir />
      </NamedRoutes.Provider>,
    )
    await renderer.act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 1100)
        }),
    )
    expect(tree).toMatchSnapshot()
  })
})
