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
  // stripCompression is consumed by Text.js's findLang pipeline at import time
  // when we re-use its highlighting helpers; the identity function is fine
  // for these tests since the input keys here have no compression suffix.
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

import { detect, Loader } from './TextFallback'

describe('components/Preview/loaders/TextFallback', () => {
  it('always detects', () => {
    expect(detect()).toBe(true)
  })

  it('renders text content from a normal preview response', () => {
    previewState.value = {
      info: { data: { head: ['hello', 'world'], tail: [] } },
      html: '',
    }
    let received: unknown
    render(
      <Loader
        handle={{ key: 'foo.weird' } as never}
        children={(value: unknown) => {
          received = value
          return null
        }}
      />,
    )
    expect((received as $TSFixMe).ok).toBe(true)
    expect((received as $TSFixMe).value.tag).toBe('Text')
    expect((received as $TSFixMe).value.value.head).toBe('hello\nworld')
  })

  it('surfaces a binary envelope as Unsupported PreviewError', () => {
    previewState.value = {
      info: { error: 'binary', detected: 'hdf5' },
      html: '',
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
})
