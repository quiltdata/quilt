import { describe, it, expect } from 'vitest'
import { CombinedError } from 'urql'

import { isAuthLost, classifyAuthLoss } from './urqlExchange'

// A real urql CombinedError with a real fetch Response, so the test exercises
// the actual contract (status read off error.response) rather than a shape we
// invented — it would catch a urql upgrade that relocated the status.
const err = (status?: number, graphQLErrors: { message: string }[] = []) =>
  new CombinedError({
    graphQLErrors,
    response: status == null ? undefined : new Response(null, { status }),
  })

const classify = (over: Partial<Parameters<typeof classifyAuthLoss>[0]>) =>
  classifyAuthLoss({
    handleInvalidToken: true,
    is401: true,
    authAttached: false,
    authenticated: false,
    waiting: false,
    ...over,
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
    it('does not flag a 200 that carries graphQLErrors (not auth-loss)', () => {
      expect(isAuthLost(err(200, [{ message: 'boom' }]))).toBe(false)
    })
    it('does not flag a network error with no response', () => {
      expect(isAuthLost(err(undefined))).toBe(false)
    })
    it('does not flag a missing error', () => {
      expect(isAuthLost(undefined)).toBe(false)
    })
  })

  describe('classifyAuthLoss', () => {
    it('passes through when interception is disabled', () => {
      expect(classify({ handleInvalidToken: false })).toBe('passthrough')
      expect(classify({ handleInvalidToken: undefined })).toBe('passthrough')
    })
    it('passes through a non-401', () => {
      expect(classify({ is401: false })).toBe('passthrough')
    })
    it('redirects a handled 401 that carried a credential (dead session)', () => {
      expect(classify({ authAttached: true })).toBe('redirect')
    })
    it('holds a handled no-credential 401 while a session exists or is arriving', () => {
      expect(classify({ authAttached: false, waiting: true })).toBe('hold')
      expect(classify({ authAttached: false, authenticated: true })).toBe('hold')
    })
    it('redirects a handled no-credential 401 with no session in sight', () => {
      expect(classify({})).toBe('redirect')
    })
  })
})
