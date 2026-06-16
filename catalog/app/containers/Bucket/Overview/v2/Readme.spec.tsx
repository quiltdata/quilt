import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import AsyncResult from 'utils/AsyncResult'

import Readme from './Readme'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('../../Summarize', () => ({
  FilePreview: ({ handle }: { handle: { bucket: string; key: string } }) => (
    <div data-testid="file-preview">{`${handle.bucket}/${handle.key}`}</div>
  ),
  FilePreviewSkel: () => <div data-testid="file-preview-skel" />,
}))

const fetchResult = vi.fn()

vi.mock('utils/Data', () => ({
  Fetcher: ({ children }: { children: (r: unknown) => React.ReactNode }) =>
    children(fetchResult()),
}))

vi.mock('utils/AWS', () => ({
  S3: { use: () => ({}) },
}))

describe('containers/Bucket/Overview/v2/Readme', () => {
  afterEach(cleanup)

  it('renders exactly one preview when there are multiple readmes', () => {
    fetchResult.mockReturnValue(
      AsyncResult.Ok([
        { bucket: 'b', key: 'README.md' },
        { bucket: 'b', key: 'README.txt' },
      ]),
    )
    const { queryAllByTestId } = render(<Readme bucket="b" />)
    expect(queryAllByTestId('readme-preview')).toHaveLength(1)
    expect(queryAllByTestId('file-preview')).toHaveLength(1)
  })

  it('renders nothing when there are no readmes', () => {
    fetchResult.mockReturnValue(AsyncResult.Ok([]))
    const { queryByTestId } = render(<Readme bucket="b" />)
    expect(queryByTestId('readme-preview')).toBeFalsy()
  })
})
