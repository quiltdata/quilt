import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import AsyncResult from 'utils/AsyncResult'

import Readme, { CollapsibleMarkdown } from './Readme'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/Markdown', () => ({
  default: ({ data }: { data: string }) => (
    <div data-testid="readme-markdown">{data}</div>
  ),
}))

// Overflow detection is layout-driven (jsdom reports 0); mock the hook so tests
// drive the toggle directly instead of faking element sizes.
const useContentOverflows = vi.fn<() => boolean>()
vi.mock('./useContentOverflows', () => ({
  useContentOverflows: () => useContentOverflows(),
}))

// `bucketReadmes` is fetched via the outer Fetcher; the readme text is fetched
// via the inner `useData`. Both go through `utils/Data`, so we route them by
// the request fn: `requests.bucketReadmes` (outer) vs the text fetcher (inner).
const readmesResult = vi.fn()
const textResult = vi.fn(() => AsyncResult.Ok('# Hello'))

vi.mock('../../requests', () => ({ bucketReadmes: vi.fn() }))

vi.mock('utils/Data', async () => {
  const requests = await import('../../requests')
  const route = (fetch: unknown) =>
    fetch === (requests as { bucketReadmes: unknown }).bucketReadmes
      ? readmesResult()
      : textResult()
  return {
    Fetcher: ({
      fetch,
      children,
    }: {
      fetch: unknown
      children: (r: unknown) => React.ReactNode
    }) => children(route(fetch)),
    useData: (fetch: unknown) => ({
      case: (cases: $TSFixMe) => AsyncResult.case(cases, route(fetch)),
    }),
  }
})

vi.mock('utils/AWS', () => ({
  S3: { use: () => ({}) },
}))

describe('containers/Bucket/Overview/v2/Readme', () => {
  afterEach(cleanup)

  it('renders the markdown of the chosen readme', () => {
    readmesResult.mockReturnValue(
      AsyncResult.Ok([
        { bucket: 'b', key: 'README.md' },
        { bucket: 'b', key: 'README.txt' },
      ]),
    )
    const { queryAllByTestId, getByTestId } = render(<Readme bucket="b" />)
    expect(queryAllByTestId('readme-preview')).toHaveLength(1)
    expect(getByTestId('readme-markdown').textContent).toBe('# Hello')
  })

  it('renders nothing when there are no readmes', () => {
    readmesResult.mockReturnValue(AsyncResult.Ok([]))
    const { queryByTestId } = render(<Readme bucket="b" />)
    expect(queryByTestId('readme-preview')).toBeFalsy()
    expect(queryByTestId('readme-markdown')).toBeFalsy()
  })

  it('renders nothing (no stuck skeleton) when the readme listing fails', () => {
    readmesResult.mockReturnValue(AsyncResult.Err(new Error('boom')))
    const { container, queryByTestId } = render(<Readme bucket="b" />)
    expect(queryByTestId('readme-preview')).toBeFalsy()
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when the only readme is a notebook', () => {
    readmesResult.mockReturnValue(AsyncResult.Ok([{ bucket: 'b', key: 'README.ipynb' }]))
    const { queryByTestId } = render(<Readme bucket="b" />)
    expect(queryByTestId('readme-preview')).toBeFalsy()
    expect(queryByTestId('readme-markdown')).toBeFalsy()
  })

  it('skips the notebook and renders the markdown readme', () => {
    readmesResult.mockReturnValue(
      AsyncResult.Ok([
        { bucket: 'b', key: 'README.md' },
        { bucket: 'b', key: 'README.ipynb' },
      ]),
    )
    const { queryAllByTestId, getByTestId } = render(<Readme bucket="b" />)
    expect(queryAllByTestId('readme-preview')).toHaveLength(1)
    expect(getByTestId('readme-markdown').textContent).toBe('# Hello')
  })
})

describe('containers/Bucket/Overview/v2/Readme CollapsibleMarkdown', () => {
  afterEach(cleanup)

  it('shows no toggle when the content fits', () => {
    useContentOverflows.mockReturnValue(false)
    const { queryByRole } = render(<CollapsibleMarkdown text="# short" />)
    expect(queryByRole('button')).toBeFalsy()
  })

  it('shows "Read more" when the content overflows and toggles on click', () => {
    useContentOverflows.mockReturnValue(true)
    const { getByRole } = render(<CollapsibleMarkdown text="# long" />)
    const button = getByRole('button')
    expect(button.textContent).toBe('Read more')
    fireEvent.click(button)
    expect(getByRole('button').textContent).toBe('Show less')
    fireEvent.click(getByRole('button'))
    expect(getByRole('button').textContent).toBe('Read more')
  })
})
