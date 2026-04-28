import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import type * as Model from 'model'

vi.mock('constants/config', () => ({
  default: { serviceBucket: 'test-bucket', mode: 'PRODUCT' },
}))

const putObjectMock = vi.fn<
  (params: { Bucket: string; Key: string; ContentType?: string; Body: unknown }) => {
    promise: () => Promise<{ VersionId?: string }>
  }
>(() => ({ promise: () => Promise.resolve({}) }))
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
  // TODO: remove custom polyfill after updating `jsdom` (https://github.com/jsdom/jsdom/pull/4050)
  if (!f.arrayBuffer) {
    ;(f as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
      new TextEncoder().encode(body).buffer as ArrayBuffer
  }
  return f
}

describe('utils/CatalogSettings', () => {
  describe('useUploadFile', () => {
    it('uploads file with extension-based key and returns S3 location', async () => {
      putObjectMock.mockClear()
      putObjectMock.mockReturnValueOnce({
        promise: () => Promise.resolve({ VersionId: 'v1' }),
      })
      const { result } = renderHook(() => useUploadFile())
      let uploaded: Model.S3.S3ObjectLocation | undefined
      await act(async () => {
        uploaded = await result.current(makeFile('brand.svg', 'image/svg+xml'))
      })
      expect(uploaded).toEqual({
        bucket: 'test-bucket',
        key: 'catalog/logo.svg',
        version: 'v1',
      })
      expect(putObjectMock).toHaveBeenCalledTimes(1)
      const arg = putObjectMock.mock.calls[0][0]
      expect(arg.Bucket).toBe('test-bucket')
      expect(arg.Key).toBe('catalog/logo.svg')
      expect(arg.ContentType).toBe('image/svg+xml')
      expect(arg.Body).toBeInstanceOf(Uint8Array)
    })

    it('omits extension when filename has none', async () => {
      putObjectMock.mockClear()
      const { result } = renderHook(() => useUploadFile())
      let uploaded: Model.S3.S3ObjectLocation | undefined
      await act(async () => {
        uploaded = await result.current(makeFile('logo', ''))
      })
      expect(uploaded).toEqual({
        bucket: 'test-bucket',
        key: 'catalog/logo',
        version: undefined,
      })
      const arg = putObjectMock.mock.calls[0][0]
      expect(arg.Key).toBe('catalog/logo')
      expect(arg.ContentType).toBeUndefined()
    })

    it('uses last extension for multi-dot filenames', async () => {
      putObjectMock.mockClear()
      const { result } = renderHook(() => useUploadFile())
      await act(async () => {
        await result.current(makeFile('my.company.logo.png'))
      })
      expect(putObjectMock.mock.calls[0][0].Key).toBe('catalog/logo.png')
    })
  })
})
