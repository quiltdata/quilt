import * as React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

// ArchivedMessage transitively pulls Thumbnail -> BucketCache -> utils/Data,
// which needs a full AsyncResult; stub it since Display.spec only exercises the
// Unsupported error path.
vi.mock('./ArchivedMessage', () => ({ default: () => null }))
vi.mock('./render', () => ({ default: vi.fn() }))
vi.mock('./types', () => ({
  PreviewError: {
    case: (cases: Record<string, (value: any) => unknown>) => (value: { tag: string }) =>
      cases[value.tag](value),
  },
}))

import PreviewDisplay from './Display'

afterEach(() => {
  cleanup()
})

describe('components/Preview/Display', () => {
  it('renders the custom Unsupported message when provided', () => {
    render(
      <PreviewDisplay
        data={{
          tag: 'Err',
          value: {
            tag: 'Unsupported',
            handle: { bucket: 'demo', key: 'foo.h5' },
            message: 'Binary file (hdf5) — no text preview available',
          },
        }}
      />,
    )

    expect(screen.getByText('Preview Not Supported')).toBeTruthy()
    expect(
      screen.getByText('Binary file (hdf5) — no text preview available'),
    ).toBeTruthy()
  })

  it('falls back to the default Unsupported message', () => {
    render(
      <PreviewDisplay
        data={{
          tag: 'Err',
          value: {
            tag: 'Unsupported',
            handle: { bucket: 'demo', key: 'foo.bin' },
          },
        }}
      />,
    )

    expect(screen.getByText('Preview Not Supported')).toBeTruthy()
    expect(screen.getByText('Previewing this data type is not supported')).toBeTruthy()
  })
})
