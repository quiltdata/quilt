import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConfigureAppearance } from './Summarize'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  Button: ({ children }: { children: React.ReactNode }) => (
    <div id="button">{children}</div>
  ),
  Tooltip: ({ title, children }: React.PropsWithChildren<{ title: React.ReactNode }>) => (
    <div>
      {title}
      <hr />
      {children}
    </div>
  ),
}))

vi.mock('components/Preview', () => ({}))
vi.mock('components/Preview/loaders/summarize', () => ({}))
vi.mock('./requests', () => ({}))
vi.mock('./errors', () => ({}))
vi.mock('components/Markdown', () => ({}))
vi.mock('components/FileEditor/FileEditor', () => ({}))

vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: vi.fn(() => ({
    urls: {
      bucketPackageDetail: (b: string, n: string, opts: any) =>
        `package: ${b}/${n} ${JSON.stringify(opts)}`,
      bucketFile: (b: string, k: string, opts: any) =>
        `file: ${b}/${k} ${JSON.stringify(opts)}`,
    },
  })),
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  Link: ({ to, children }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to}>{children}</a>
  ),
}))

describe('containers/Buckets/Summarize', () => {
  describe('ConfigureAppearance', () => {
    const packageHandle = { bucket: 'b', name: 'n', hash: 'h' }

    it('should not render buttons when there are files out there', () => {
      const { container } = render(
        <ConfigureAppearance
          hasReadme
          hasSummarizeJson
          packageHandle={packageHandle}
          path=""
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render readme link', () => {
      const { container } = render(
        <ConfigureAppearance
          hasReadme={false}
          hasSummarizeJson
          packageHandle={packageHandle}
          path=""
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render quilt_summarize link', () => {
      const { container } = render(
        <ConfigureAppearance
          hasReadme
          hasSummarizeJson={false}
          packageHandle={packageHandle}
          path=""
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render both links', () => {
      const { container } = render(
        <ConfigureAppearance
          hasReadme={false}
          hasSummarizeJson={false}
          packageHandle={packageHandle}
          path="some/path"
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })
  })
})
