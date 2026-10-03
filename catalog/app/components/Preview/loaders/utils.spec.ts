import { renderHook } from '@testing-library/react-hooks'
import { afterEach, describe, it, expect, vi } from 'vitest'

import { HTTPError } from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'

import { PreviewError } from '../types'

import { loadTabularData } from './Tabular'
import { fetchPreview, useErrorHandling, useProcessing } from './utils'

vi.mock('constants/config', () => ({ default: {} }))

describe('Preview/loaders/utils', () => {
  describe('useProcessing', () => {
    it('maps Ok through process', () => {
      const { result } = renderHook(() =>
        useProcessing(AsyncResult.Ok(2), (n: number) => n * 3),
      )
      expect(
        AsyncResult.case({ Ok: (v: number) => v, _: () => null }, result.current),
      ).toBe(6)
    })

    it('converts a thrown Error into AsyncResult.Err', () => {
      const boom = new Error('boom')
      const { result } = renderHook(() =>
        useProcessing(AsyncResult.Ok('x'), () => {
          throw boom
        }),
      )
      expect(result.error).toBeUndefined()
      expect(
        AsyncResult.case({ Err: (e: unknown) => e, _: () => null }, result.current),
      ).toBe(boom)
    })

    // Regression: a lazy-grammar Suspense throw must propagate, not become an Err
    // (that was the "Promise pending" error screen).
    it('re-throws a thrown thenable instead of swallowing it into Err', () => {
      const suspender = Promise.resolve()
      const { result } = renderHook(() =>
        useProcessing(AsyncResult.Ok('x'), () => {
          throw suspender
        }),
      )
      const producedErr =
        result.current != null &&
        AsyncResult.case({ Err: () => true, _: () => false }, result.current)
      expect(producedErr).toBe(false)
    })
  })

  describe('useErrorHandling', () => {
    it("shows a lambda's 5xx reason instead of the generic message", () => {
      const e = new HTTPError(
        { status: 500, statusText: 'Internal Server Error' },
        'Parquet magic bytes not found in footer',
      )
      const { result } = renderHook(() => useErrorHandling(AsyncResult.Err(e)))
      const err = AsyncResult.case(
        { Err: (x: unknown) => x, _: () => null },
        result.current,
      )
      expect(PreviewError.Unexpected.unbox(err).message).toBe(
        'Parquet magic bytes not found in footer',
      )
    })

    it('drops the signed query from a URL the reason quotes', () => {
      const e = new HTTPError(
        { status: 500, statusText: 'Internal Server Error' },
        "FileNotFoundError('https://b/k.parquet?X-Amz-Signature=s1'); url: /k.csv?X-Amz-Signature=s2",
      )
      const { result } = renderHook(() => useErrorHandling(AsyncResult.Err(e)))
      const err = AsyncResult.case(
        { Err: (x: unknown) => x, _: () => null },
        result.current,
      )
      expect(PreviewError.Unexpected.unbox(err).message).toBe(
        "FileNotFoundError('https://b/k.parquet'); url: /k.csv",
      )
    })
  })

  // Through the loaders' own fetch, so dropping the body read fails here.
  describe('lambda responses', () => {
    const handle = { bucket: 'b', key: 'k.parquet' }
    const sign = () => 'https://b/k.parquet?X-Amz-Signature=s'

    const respond = (status: number, body: string) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(body, { status })),
      )

    const toPreviewError = async (p: Promise<unknown>) => {
      const e = await p.catch((x: unknown) => x)
      const { result } = renderHook(() =>
        useErrorHandling(AsyncResult.Err(e), { handle }),
      )
      return AsyncResult.case({ Err: (x: unknown) => x, _: () => null }, result.current)
    }

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('surfaces the 5xx body from the preview endpoint', async () => {
      respond(500, 'Parquet magic bytes not found in footer')
      const err = await toPreviewError(
        fetchPreview({
          handle,
          sign,
          type: 'parquet',
          compression: undefined,
          query: undefined,
        }),
      )
      expect(PreviewError.Unexpected.unbox(err).message).toBe(
        'Parquet magic bytes not found in footer',
      )
    })

    it('surfaces the 5xx body from the tabular endpoint', async () => {
      respond(502, 'Parquet magic bytes not found in footer')
      const err = await toPreviewError(
        loadTabularData({ handle, sign, type: 'parquet', size: 'small' }),
      )
      expect(PreviewError.Unexpected.unbox(err).message).toBe(
        'Parquet magic bytes not found in footer',
      )
    })

    it('keeps the generic message for a 4xx from the tabular endpoint', async () => {
      respond(403, 'Forbidden')
      const err = await toPreviewError(
        loadTabularData({ handle, sign, type: 'parquet', size: 'small' }),
      )
      expect(PreviewError.Unexpected.unbox(err).message).toBeUndefined()
    })

    it('maps an error in a 200 preview response to its preview error', async () => {
      respond(200, JSON.stringify({ error: 'Forbidden' }))
      const err = await toPreviewError(
        fetchPreview({
          handle,
          sign,
          type: 'parquet',
          compression: undefined,
          query: undefined,
        }),
      )
      expect(PreviewError.Forbidden.is(err)).toBe(true)
    })
  })
})
