import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

import { ConfigureAppearance, SummaryEntries } from './Summarize'

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
vi.mock('./requests', () => ({ ensureObjectIsPresent: () => {} }))
vi.mock('./errors', () => ({}))
vi.mock('components/Markdown', () => ({}))
vi.mock('components/FileEditor/FileEditor', () => ({}))

// Keep the entry rows free of the Preview/availability machinery: every `Row`
// renders through `EnsureAvailability`, which resolves to nothing here, so we
// can assert title/grid behavior driven purely by the entries themselves.
vi.mock('utils/Data', () => ({
  useData: () => ({ case: ({ _ }: { _: () => React.ReactNode }) => _() }),
}))

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

  describe('SummaryEntries', () => {
    // Empty entries keep the test free of the heavy `Row`/`FileHandle`/S3
    // machinery while still rendering the container, where the grid layout is
    // applied — so we can assert auto-discovery is gridded and authored is not.
    const s3 = {} as any

    it('applies a multi-column grid container when `columns` is set', () => {
      const { container } = render(<SummaryEntries entries={[]} columns={2} s3={s3} />)
      const root = container.firstChild as HTMLElement
      expect(root.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
    })

    it('does not apply a grid container without `columns` (legacy/authored flow)', () => {
      const { container } = render(<SummaryEntries entries={[]} s3={s3} />)
      // With a `title` node present, the entries grid is the second child; with
      // empty entries no title renders, so the grid is the first (and only) child.
      const root = container.firstChild as HTMLElement
      expect(root.style.gridTemplateColumns).toBe('')
    })

    // A single non-array entry; its `Row` resolves to nothing via the mocked
    // availability check, so the only observable output is the optional title.
    const oneEntry = [
      { handle: { bucket: 'b', key: 'k' }, path: 'k' },
    ] as unknown as Parameters<typeof SummaryEntries>[0]['entries']

    it('renders the `title` node above the entries when there is at least one', () => {
      const { getByText } = render(
        <SummaryEntries
          entries={oneEntry}
          s3={s3}
          title={<div data-testid="section-title">Files</div>}
        />,
      )
      expect(getByText('Files')).toBeTruthy()
    })

    it('does not render a lone `title` when entries are empty', () => {
      const { queryByTestId } = render(
        <SummaryEntries
          entries={[]}
          s3={s3}
          title={<div data-testid="section-title">Files</div>}
        />,
      )
      expect(queryByTestId('section-title')).toBeNull()
    })

    it('renders nothing extra without a `title` (legacy path)', () => {
      const { queryByTestId } = render(<SummaryEntries entries={oneEntry} s3={s3} />)
      expect(queryByTestId('section-title')).toBeNull()
    })
  })

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
