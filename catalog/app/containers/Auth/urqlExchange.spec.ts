import { describe, it, expect } from 'vitest'
import { CombinedError } from 'urql'

import { isAuthLost, decideAuthLoss } from './urqlExchange'

// A real urql CombinedError with a real fetch Response, so the test exercises
// the actual contract (status read off error.response) rather than a shape we
// invented — it would catch a urql upgrade that relocated the status.
const err = (status?: number) =>
  new CombinedError({
    graphQLErrors: [],
    response: status == null ? undefined : new Response(null, { status }),
  })

const decide = (over: Partial<Parameters<typeof decideAuthLoss>[0]>) =>
  decideAuthLoss({ authAttached: false, authenticated: false, waiting: false, ...over })

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

  describe('decideAuthLoss', () => {
    it('redirects a 401 whose request carried a credential (dead session)', () => {
      expect(decide({ authAttached: true })).toBe('redirect')
      // even mid-handshake: a rejected credential is never racy
      expect(decide({ authAttached: true, waiting: true })).toBe('redirect')
    })
    it('holds a no-credential 401 while a sign-in handshake is in flight', () => {
      expect(decide({ authAttached: false, waiting: true })).toBe('hold')
    })
    it('holds a no-credential 401 once a session already exists (stale straggler)', () => {
      expect(decide({ authAttached: false, authenticated: true })).toBe('hold')
    })
    it('redirects a no-credential 401 with no session and no sign-in in flight', () => {
      expect(decide({ authAttached: false, authenticated: false, waiting: false })).toBe(
        'redirect',
      )
    })
  })
})
