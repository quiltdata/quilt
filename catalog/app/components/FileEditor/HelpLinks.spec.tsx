import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

import noop from 'utils/noop'

import { WorkflowsConfigLink } from './HelpLinks'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/StyledLink', () => ({
  default: ({
    href,
    to,
    children,
  }: React.PropsWithChildren<{ href: string; to: string }>) => (
    <a href={to || href}>{children}</a>
  ),
}))

vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: () => ({
    urls: {
      bucketFile: (b: string, k: string, opts: Record<string, any>) => {
        const params = new URLSearchParams(opts)
        return `/b/${b}/tree/k/${k}?${params}`
      },
    },
  }),
}))

const useLocation = () =>
  ({ pathname: '/a/b/c', search: '?foo=bar' }) as Record<string, string>

const useParams = vi.fn(() => ({ bucket: 'buck' }) as Record<string, string>)

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => useParams(),
  useLocation: () => useLocation(),
}))

describe('components/FileEditor/HelpLinks', () => {
  afterEach(cleanup)

  describe('WorkflowsConfigLink', () => {
    it('should render', () => {
      const { getByText } = render(<WorkflowsConfigLink>Test</WorkflowsConfigLink>)
      expect(getByText('Test').getAttribute('href')).toContain(
        '/b/buck/tree/k/.quilt/workflows/config.yml?edit=true&next=%2Fa%2Fb%2Fc%3Ffoo%3Dbar',
      )
    })

    it('should throw outside bucket', () => {
      vi.spyOn(console, 'error').mockImplementationOnce(noop)
      useParams.mockImplementationOnce(() => ({}))
      const tree = () => render(<WorkflowsConfigLink>Any</WorkflowsConfigLink>)
      expect(tree).toThrowError('`bucket` must be defined')
    })
  })
})
