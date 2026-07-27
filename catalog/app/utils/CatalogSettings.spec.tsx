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

import { useUploadFile, UnsupportedLogoTypeError } from './CatalogSettings'

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
    it.each([
      ['image/png', 'catalog/logo.png'],
      ['image/jpeg', 'catalog/logo.jpg'],
      ['image/webp', 'catalog/logo.webp'],
      ['image/gif', 'catalog/logo.gif'],
    ])('derives key from MIME type %s -> %s', async (mime, expectedKey) => {
      putObjectMock.mockClear()
      putObjectMock.mockReturnValueOnce({
        promise: () => Promise.resolve({ VersionId: 'v1' }),
      })
      const { result } = renderHook(() => useUploadFile())
      let uploaded: Model.S3.S3ObjectLocation | undefined
      await act(async () => {
        uploaded = await result.current(makeFile('whatever.bin', mime))
      })
      expect(uploaded).toEqual({
        bucket: 'test-bucket',
        key: expectedKey,
        version: 'v1',
      })
      const arg = putObjectMock.mock.calls[0][0]
      expect(arg.Key).toBe(expectedKey)
      expect(arg.ContentType).toBe(mime)
      expect(arg.Body).toBeInstanceOf(Uint8Array)
    })

    it('rejects SVG (intentionally not on the IAM allowlist)', async () => {
      putObjectMock.mockClear()
      const { result } = renderHook(() => useUploadFile())
      await expect(
        result.current(makeFile('brand.svg', 'image/svg+xml')),
      ).rejects.toBeInstanceOf(UnsupportedLogoTypeError)
      expect(putObjectMock).not.toHaveBeenCalled()
    })

    it('rejects file with empty MIME type', async () => {
      putObjectMock.mockClear()
      const { result } = renderHook(() => useUploadFile())
      await expect(result.current(makeFile('logo', ''))).rejects.toBeInstanceOf(
        UnsupportedLogoTypeError,
      )
      expect(putObjectMock).not.toHaveBeenCalled()
    })

    it('ignores filename extension; uses MIME type', async () => {
      putObjectMock.mockClear()
      const { result } = renderHook(() => useUploadFile())
      await act(async () => {
        await result.current(makeFile('my.company.logo.gif', 'image/png'))
      })
      expect(putObjectMock.mock.calls[0][0].Key).toBe('catalog/logo.png')
    })
  })
})
