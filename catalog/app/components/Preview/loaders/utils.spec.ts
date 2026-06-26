import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import AsyncResult from 'utils/AsyncResult'

import { useProcessing } from './utils'

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

    // Regression: a grammar loaded on demand throws a Suspense promise from the
    // process fn. useProcessing must re-throw it (renderHook treats that as a
    // suspension, so no value is produced) rather than swallow it into
    // AsyncResult.Err — the latter surfaced as a "Promise pending" error screen on
    // first preview render.
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
})
