import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import { HTTPError } from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'

import { PreviewError } from '../types'

import { useErrorHandling, useProcessing } from './utils'

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
})
