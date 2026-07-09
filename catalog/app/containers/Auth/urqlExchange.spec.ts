import { describe, it, expect } from 'vitest'
import { CombinedError } from 'urql'

import { isAuthLost, isHandshakeRace } from './urqlExchange'

// urql attaches the raw fetch Response to CombinedError.response, so its
// HTTP status is available even when the 401 body parses into graphQLErrors.
const errorWithStatus = (status?: number) =>
  new CombinedError({
    graphQLErrors: [],
    response: status == null ? undefined : { status },
  })

describe('containers/Auth/urqlExchange', () => {
  describe('isAuthLost', () => {
    it('flags a 401 (unauthenticatable request)', () => {
      expect(isAuthLost(errorWithStatus(401))).toBe(true)
    })

    it('does not flag 403 (authenticated but forbidden)', () => {
      expect(isAuthLost(errorWithStatus(403))).toBe(false)
    })

    it('does not flag a 5xx', () => {
      expect(isAuthLost(errorWithStatus(500))).toBe(false)
    })

    it('does not flag a network error with no response', () => {
      expect(isAuthLost(errorWithStatus(undefined))).toBe(false)
    })

    it('does not flag a missing error', () => {
      expect(isAuthLost(undefined)).toBe(false)
    })
  })

  describe('isHandshakeRace', () => {
    it('true only while waiting AND no credential was sent', () => {
      expect(isHandshakeRace(true, false)).toBe(true)
    })

    it('false when a credential was sent (a genuinely dead session)', () => {
      expect(isHandshakeRace(true, true)).toBe(false)
    })

    it('false when not waiting (an ordinary logged-out 401)', () => {
      expect(isHandshakeRace(false, false)).toBe(false)
    })

    it('false when not waiting even if a credential was sent', () => {
      expect(isHandshakeRace(false, true)).toBe(false)
    })
  })
})
