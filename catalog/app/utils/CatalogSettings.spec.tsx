import * as React from 'react'
import { render, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('constants/config', () => ({
  default: { serviceBucket: 'test-bucket', mode: 'PRODUCT' },
}))

const putObjectMock = vi.fn(() => ({ promise: () => Promise.resolve({}) }))
const s3Mock = { putObject: putObjectMock }

vi.mock('utils/AWS', () => ({
  S3: { use: () => s3Mock },
}))

vi.mock('utils/ResourceCache', () => ({
  createResource: () => ({}),
  use: () => ({ patchOk: vi.fn() }),
  useData: () => null,
}))

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

import { useUploadFile } from './CatalogSettings'

function makeFile(name: string, type = 'image/png', body = 'x') {
  const f = new File([body], name, { type })
  // jsdom File lacks arrayBuffer in some envs; polyfill
  if (!f.arrayBuffer) {
    // @ts-expect-error
    f.arrayBuffer = async () => new TextEncoder().encode(body).buffer
  }
  return f
}

function captureHook<T>(hook: () => T): { current: T } {
  const ref: { current: T } = { current: undefined as unknown as T }
  function Probe() {
    ref.current = hook()
    return null
  }
  render(<Probe />)
  return ref
}

describe('utils/CatalogSettings', () => {
  describe('useUploadFile', () => {
    it('uploads file with extension-based key and returns s3 URL', async () => {
      putObjectMock.mockClear()
      const ref = captureHook(() => useUploadFile())
      let result: string | undefined
      await act(async () => {
        result = await ref.current(makeFile('brand.svg', 'image/svg+xml'))
      })
      expect(result).toBe('s3://test-bucket/catalog/logo.svg')
      expect(putObjectMock).toHaveBeenCalledTimes(1)
      const arg = putObjectMock.mock.calls[0][0]
      expect(arg.Bucket).toBe('test-bucket')
      expect(arg.Key).toBe('catalog/logo.svg')
      expect(arg.ContentType).toBe('image/svg+xml')
      expect(arg.Body).toBeInstanceOf(Uint8Array)
    })

    it('omits extension when filename has none', async () => {
      putObjectMock.mockClear()
      const ref = captureHook(() => useUploadFile())
      let result: string | undefined
      await act(async () => {
        result = await ref.current(makeFile('logo', ''))
      })
      expect(result).toBe('s3://test-bucket/catalog/logo')
      const arg = putObjectMock.mock.calls[0][0]
      expect(arg.Key).toBe('catalog/logo')
      expect(arg.ContentType).toBeUndefined()
    })

    it('uses last extension for multi-dot filenames', async () => {
      putObjectMock.mockClear()
      const ref = captureHook(() => useUploadFile())
      await act(async () => {
        await ref.current(makeFile('my.company.logo.png'))
      })
      expect(putObjectMock.mock.calls[0][0].Key).toBe('catalog/logo.png')
    })
  })
})
