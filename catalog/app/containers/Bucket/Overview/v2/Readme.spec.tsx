import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

import AsyncResult from 'utils/AsyncResult'

import Readme, { CollapsibleMarkdown } from './Readme'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/Markdown', () => ({
  default: ({ data }: { data: string }) => (
    <div data-testid="readme-markdown">{data}</div>
  ),
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

// The collapse toggle's visibility is driven by a layout measurement
// (`scrollHeight` vs `clientHeight`) that jsdom always reports as 0. We stub
// those props on the element prototype to simulate overflowing vs. fitting
// content; the actual pixel measurement is layout-dependent and not asserted.
describe('containers/Bucket/Overview/v2/Readme CollapsibleMarkdown', () => {
  let scrollHeightSpy: ReturnType<typeof vi.spyOn>
  let clientHeightSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // ResizeObserver is absent in jsdom; provide a no-op so the effect's
    // one-shot `measure()` still runs without throwing.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}

        disconnect() {}

        unobserve() {}
      },
    )
  })

  afterEach(() => {
    scrollHeightSpy?.mockRestore()
    clientHeightSpy?.mockRestore()
    vi.unstubAllGlobals()
  })

  function stubOverflow(overflows: boolean) {
    scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(overflows ? 1000 : 0)
    clientHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockReturnValue(0)
  }

  it('shows no toggle when the content fits', () => {
    stubOverflow(false)
    const { queryByRole } = render(<CollapsibleMarkdown text="# short" />)
    expect(queryByRole('button')).toBeFalsy()
  })

  it('shows "Read more" when the content overflows and toggles on click', () => {
    stubOverflow(true)
    const { getByRole } = render(<CollapsibleMarkdown text="# long" />)
    const button = getByRole('button')
    expect(button.textContent).toBe('Read more')
    fireEvent.click(button)
    expect(getByRole('button').textContent).toBe('Show less')
    fireEvent.click(getByRole('button'))
    expect(getByRole('button').textContent).toBe('Read more')
  })
})
