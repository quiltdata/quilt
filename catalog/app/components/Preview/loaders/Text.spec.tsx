import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { fetch, previewState } = vi.hoisted(() => {
  const fetchMock = vi.fn()
  const state: { value: unknown } = { value: undefined }
  return { fetch: fetchMock, previewState: state }
})

vi.mock('../types', () => ({
  PreviewData: {
    Text: (value: unknown) => ({ tag: 'Text', value }),
  },
  PreviewError: {
    Unexpected: (value: unknown) => {
      const err: Error & { tag: string; value: unknown } = Object.assign(
        new Error('Unexpected'),
        { tag: 'Unexpected', value },
      )
      return err
    },
    Unsupported: (value: unknown) => {
      const err: Error & { tag: string; value: unknown } = Object.assign(
        new Error('Unsupported'),
        { tag: 'Unsupported', value },
      )
      return err
    },
  },
}))

vi.mock('./utils', () => ({
  stripCompression: (s: string) => s,
  usePreview: () => ({ result: previewState.value, fetch }),
  useProcessing: (result: unknown, process: (value: unknown) => unknown) => {
    try {
      return { ok: true, value: process(result) }
    } catch (e) {
      return { ok: false, value: e }
    }
  },
  useErrorHandling: (value: unknown) => value,
}))

import { Loader } from './Text'

describe('components/Preview/loaders/Text', () => {
  it('renders text content and tolerates a missing tail', () => {
    previewState.value = {
      info: {
        data: { head: ['hello', 'world'] },
        note: 'partial preview',
        warnings: 'truncated',
      },
    }
    let received: unknown
    render(
      <Loader
        handle={{ key: 'foo.py' } as never}
        children={(value: unknown) => {
          received = value
          return null
        }}
      />,
    )

    expect((received as $TSFixMe).ok).toBe(true)
    expect((received as $TSFixMe).value.tag).toBe('Text')
    expect((received as $TSFixMe).value.value.head).toBe('hello\nworld')
    expect((received as $TSFixMe).value.value.tail).toBe('')
    expect((received as $TSFixMe).value.value.note).toBe('partial preview')
    expect((received as $TSFixMe).value.value.warnings).toBe('truncated')
  })

  it('surfaces a binary envelope as Unsupported PreviewError', () => {
    previewState.value = {
      info: { error: 'binary', detected: 'hdf5' },
    }
    let received: unknown
    render(
      <Loader
        handle={{ key: 'foo.h5' } as never}
        children={(value: unknown) => {
          received = value
          return null
        }}
      />,
    )

    expect((received as $TSFixMe).ok).toBe(false)
    const err = (received as $TSFixMe).value
    expect(err.tag).toBe('Unsupported')
    expect(String(err.value.message)).toMatch(/Binary file/)
    expect(String(err.value.message)).toMatch(/hdf5/)
  })

  it('surfaces a missing info envelope as Unexpected PreviewError', () => {
    previewState.value = { info: null }
    let received: unknown
    render(
      <Loader
        handle={{ key: 'foo.txt' } as never}
        children={(value: unknown) => {
          received = value
          return null
        }}
      />,
    )

    expect((received as $TSFixMe).ok).toBe(false)
    const err = (received as $TSFixMe).value
    expect(err.tag).toBe('Unexpected')
    expect(String(err.value.message)).toMatch(/missing info/)
    expect(err.value.retry).toBe(fetch)
  })

  it('surfaces a missing info.data envelope as Unexpected PreviewError', () => {
    previewState.value = {
      info: { data: null },
    }
    let received: unknown
    render(
      <Loader
        handle={{ key: 'foo.txt' } as never}
        children={(value: unknown) => {
          received = value
          return null
        }}
      />,
    )

    expect((received as $TSFixMe).ok).toBe(false)
    const err = (received as $TSFixMe).value
    expect(err.tag).toBe('Unexpected')
    expect(String(err.value.message)).toMatch(/missing info\.data/)
    expect(err.value.retry).toBe(fetch)
  })
})
