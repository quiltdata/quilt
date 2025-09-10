import * as React from 'react'
import { render } from '@testing-library/react'

import { WorkflowsConfigLink } from './HelpLinks'

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
      const { container } = render(<WorkflowsConfigLink>Test</WorkflowsConfigLink>)
      expect(container).toMatchSnapshot()
    })

    it('should throw outside bucket', () => {
      jest.spyOn(console, 'error').mockImplementationOnce(jest.fn())
      useParams.mockImplementationOnce(() => ({}))
      const tree = () => render(<WorkflowsConfigLink>Any</WorkflowsConfigLink>)
      expect(tree).toThrowError('`bucket` must be defined')
    })
  })
})
