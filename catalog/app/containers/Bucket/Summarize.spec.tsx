import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

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
  use: () => ({
    urls: {
      bucketPackageDetail: (b: string, n: string, opts: any) =>
        `package: ${b}/${n} ${JSON.stringify(opts)}`,
      bucketFile: (b: string, k: string, opts: any) =>
        `file: ${b}/${k} ${JSON.stringify(opts)}`,
    },
  }),
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  Link: ({ to, children }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to}>{children}</a>
  ),
}))

describe('containers/Buckets/Summarize', () => {
  afterEach(cleanup)

  describe('ConfigureAppearance', () => {
    const packageHandle = { bucket: 'b', name: 'n', hash: 'h' }

    it('should not render buttons when there are files out there', () => {
      const { container, queryByText } = render(
        <ConfigureAppearance
          hasReadme
          hasSummarizeJson
          packageHandle={packageHandle}
          path=""
        />,
      )
      expect(queryByText('Add README')).toBeFalsy()
      expect(queryByText('Configure Summary')).toBeFalsy()
      expect((container.firstChild as HTMLElement).children).toHaveLength(0)
    })

    it('should render readme link', () => {
      const { getByText } = render(
        <ConfigureAppearance
          hasReadme={false}
          hasSummarizeJson
          packageHandle={packageHandle}
          path=""
        />,
      )
      expect(getByText('Add README').closest('a')?.getAttribute('href')).toBe(
        'file: b/n/README.md {"add":"quilt+s3://b#package=n&path=README.md","edit":true}',
      )
    })

    it('should render quilt_summarize link', () => {
      const { getByText } = render(
        <ConfigureAppearance
          hasReadme
          hasSummarizeJson={false}
          packageHandle={packageHandle}
          path=""
        />,
      )
      expect(getByText('Configure Summary').closest('a')?.getAttribute('href')).toBe(
        'file: b/n/quilt_summarize.json {"add":"quilt+s3://b#package=n&path=quilt_summarize.json","edit":true}',
      )
    })

    it('should render both links', () => {
      const { getByText } = render(
        <ConfigureAppearance
          hasReadme={false}
          hasSummarizeJson={false}
          packageHandle={packageHandle}
          path="some/path"
        />,
      )
      expect(getByText('Configure Summary').closest('a')?.getAttribute('href')).toBe(
        'file: b/n/some/path/quilt_summarize.json {"add":"quilt+s3://b#package=n&path=some%2Fpath%2Fquilt_summarize.json","edit":true}',
      )

      expect(getByText('Add README').closest('a')?.getAttribute('href')).toBe(
        'file: b/n/some/path/README.md {"add":"quilt+s3://b#package=n&path=some%2Fpath%2FREADME.md","edit":true}',
      )
    })
  })
})
