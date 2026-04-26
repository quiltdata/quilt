import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { fetch, previewDataFcs, previewResponse } = vi.hoisted(() => {
  const fetchMock = vi.fn()
  const previewDataFcsMock = vi.fn((value: unknown) => value)
  const previewResponseValue = {
    html: '<div>preview</div>',
    info: {
      metadata: { sample: 'A' },
      vegaLite: { mark: 'point' },
      note: 'note',
      warnings: 'warn',
    },
  }
  return {
    fetch: fetchMock,
    previewDataFcs: previewDataFcsMock,
    previewResponse: previewResponseValue,
  }
})

vi.mock('../types', () => ({
  PreviewData: {
    Fcs: previewDataFcs,
  },
}))

vi.mock('./utils', () => ({
  stripCompression: (value: string) => value,
  extIs: (ext: string) => (value: string) => value.endsWith(ext),
  usePreview: () => ({ result: previewResponse, fetch }),
  useProcessing: (result: unknown, process: (value: unknown) => unknown) =>
    process(result),
  useErrorHandling: (value: unknown) => value,
}))

import { Loader } from './Fcs'

describe('components/Preview/loaders/Fcs', () => {
  it('passes vegaLite from preview info into PreviewData.Fcs', () => {
    let received: unknown

    render(
      <Loader
        handle={{} as never}
        children={(value: unknown) => {
          received = value
          return null
        }}
      />,
    )

    expect(previewDataFcs).toHaveBeenCalledWith({
      preview: '<div>preview</div>',
      metadata: { sample: 'A' },
      vegaLite: { mark: 'point' },
      note: 'note',
      warnings: 'warn',
    })
    expect(received).toMatchObject({ vegaLite: { mark: 'point' } })
  })
})
