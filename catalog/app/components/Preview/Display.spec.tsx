import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/AWS', () => ({
  Signer: {
    withDownloadUrl: (_handle: unknown, cb: (href: string) => unknown) =>
      cb('https://download.example.com/file'),
  },
}))
vi.mock('utils/AsyncResult', () => ({
  default: {
    case: (
      cases: Record<string, (value: any) => unknown>,
      data: { tag: string; value?: unknown },
    ) => cases[data.tag](data.value),
  },
}))
vi.mock('utils/StyledLink', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('./render', () => ({ default: vi.fn() }))
vi.mock('./types', () => ({
  PreviewError: {
    case: (cases: Record<string, (value: any) => unknown>) => (value: { tag: string }) =>
      cases[value.tag](value),
  },
}))

import PreviewDisplay from './Display'

describe('components/Preview/Display', () => {
  it('renders the custom Unsupported message when provided', () => {
    const renderMessage = vi.fn(() => null)

    render(
      <PreviewDisplay
        noDownload
        data={{
          tag: 'Err',
          value: {
            tag: 'Unsupported',
            handle: { bucket: 'demo', key: 'foo.h5' },
            message: 'Binary file (hdf5) — no text preview available',
          },
        }}
        renderMessage={renderMessage}
      />,
    )

    expect(renderMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        heading: 'Preview Not Supported',
        body: 'Binary file (hdf5) — no text preview available',
      }),
    )
  })

  it('falls back to the default Unsupported message', () => {
    const renderMessage = vi.fn(() => null)

    render(
      <PreviewDisplay
        noDownload
        data={{
          tag: 'Err',
          value: {
            tag: 'Unsupported',
            handle: { bucket: 'demo', key: 'foo.bin' },
          },
        }}
        renderMessage={renderMessage}
      />,
    )

    expect(renderMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        heading: 'Preview Not Supported',
        body: 'Previewing this data type is not supported',
      }),
    )
  })
})
