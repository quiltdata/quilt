import { describe, it, expect, vi } from 'vitest'
import { CombinedError } from 'urql'

import { authLost } from './actions'
import { InvalidToken } from './errors'
import { isAuthLost, applyAuthLoss } from './urqlExchange'

// A real urql CombinedError with a real fetch Response, so the test exercises
// the actual contract (status read off error.response) rather than a shape we
// invented — it would catch a urql upgrade that relocated the status.
const err = (status?: number) =>
  new CombinedError({
    graphQLErrors: [],
    response: status == null ? undefined : new Response(null, { status }),
  })

describe('containers/Auth/urqlExchange', () => {
  describe('isAuthLost', () => {
    it('flags a 401 carried on the response', () => {
      expect(isAuthLost(err(401))).toBe(true)
    })
    it('does not flag 403 (authenticated but forbidden)', () => {
      expect(isAuthLost(err(403))).toBe(false)
    })
    it('does not flag a 5xx', () => {
      expect(isAuthLost(err(500))).toBe(false)
    })
    it('does not flag a network error with no response', () => {
      expect(isAuthLost(err(undefined))).toBe(false)
    })
    it('does not flag a missing error', () => {
      expect(isAuthLost(undefined)).toBe(false)
    })
  })

  describe('applyAuthLoss', () => {
    it('dispatches authLost (wrapping the error) on redirect', () => {
      const dispatch = vi.fn()
      const e = err(401)
      applyAuthLoss('redirect', e, dispatch)
      expect(dispatch).toHaveBeenCalledTimes(1)
      expect(dispatch).toHaveBeenCalledWith(
        authLost(new InvalidToken({ originalError: e })),
      )
    })
    it('does nothing on hold', () => {
      const dispatch = vi.fn()
      applyAuthLoss('hold', err(401), dispatch)
      expect(dispatch).not.toHaveBeenCalled()
    })
  })
})
