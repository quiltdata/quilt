import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

const useLocation = vi.fn(
  () => ({ pathname: '/a/b/c', search: '?foo=bar' }) as Record<string, string>,
)

const useParams = vi.fn(() => ({ bucket: 'buck' }) as Record<string, string>)

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: vi.fn(() => useParams()),
  useLocation: vi.fn(() => useLocation()),
}))

describe('components/FileEditor/HelpLinks', () => {
  describe('WorkflowsConfigLink', () => {
    it('should render', () => {
      const { container } = render(<WorkflowsConfigLink>Test</WorkflowsConfigLink>)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should throw outside bucket', () => {
      vi.spyOn(console, 'error').mockImplementationOnce(vi.fn())
      useParams.mockImplementationOnce(() => ({}))
      const tree = () => render(<WorkflowsConfigLink>Any</WorkflowsConfigLink>)
      expect(tree).toThrowError('`bucket` must be defined')
    })
  })
})
