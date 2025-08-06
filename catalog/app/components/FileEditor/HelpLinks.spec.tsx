import * as React from 'react'
import renderer from 'react-test-renderer'

import { MissingSourceBucket, WorkflowsConfigLink } from './HelpLinks'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

jest.mock(
  'utils/StyledLink',
  () =>
    ({ href, to, children }: React.PropsWithChildren<{ href: string; to: string }>) => (
      <a href={to || href}>{children}</a>
    ),
)

jest.mock(
  '@material-ui/core',
  jest.fn(() => ({
    ...jest.requireActual('@material-ui/core'),
    Tooltip: jest.fn(
      ({ title, children }: React.PropsWithChildren<{ title: React.ReactNode }>) => (
        <div>
          {title}
          <hr />
          {children}
        </div>
      ),
    ),
  })),
)

jest.mock('components/Code', () => ({ children }: React.PropsWithChildren<{}>) => (
  <code>{children}</code>
))

jest.mock('utils/NamedRoutes', () => ({
  ...jest.requireActual('utils/NamedRoutes'),
  use: () => ({
    urls: {
      bucketFile: (b: string, k: string, opts: Record<string, any>) => {
        const params = new URLSearchParams(opts)
        return `/b/${b}/tree/k/${k}?${params}`
      },
    },
  }),
}))

jest.mock('utils/GlobalDialogs', () => ({
  use: jest.fn(),
}))

const useLocation = jest.fn(
  () => ({ pathname: '/a/b/c', search: '?foo=bar' }) as Record<string, string>,
)

const useParams = jest.fn(() => ({ bucket: 'buck' }) as Record<string, string>)

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(() => useParams()),
  useLocation: jest.fn(() => useLocation()),
}))

describe('components/FileEditor/HelpLinks', () => {
  describe('WorkflowsConfigLink', () => {
    it('should render', () => {
      const tree = renderer
        .create(<WorkflowsConfigLink>Test</WorkflowsConfigLink>)
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should throw outside bucket', () => {
      jest.spyOn(console, 'error').mockImplementationOnce(jest.fn())
      useParams.mockImplementationOnce(() => ({}))
      const tree = () => renderer.create(<WorkflowsConfigLink>Any</WorkflowsConfigLink>)
      expect(tree).toThrowError('`bucket` must be defined')
    })
  })

  describe('MissingSourceBucket', () => {
    it('should render', () => {
      const tree = renderer
        .create(<MissingSourceBucket>Disabled button</MissingSourceBucket>)
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should throw outside bucket', () => {
      jest.spyOn(console, 'error').mockImplementationOnce(jest.fn())
      useParams.mockImplementationOnce(() => ({}))
      const tree = renderer
        .create(<MissingSourceBucket>Any</MissingSourceBucket>)
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
  })
})
