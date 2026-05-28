import { describe, it, expect } from 'vitest'
import { CombinedError } from 'urql'

import { isAuthLostError, isOnlyNotLoggedIn } from './urqlExchange'

const combinedError = (
  graphQLErrors: { message: string; extensions?: Record<string, unknown> }[] = [],
  networkError?: Error,
) => new CombinedError({ graphQLErrors, networkError })

describe('containers/Auth/urqlExchange', () => {
  describe('isAuthLostError', () => {
    it('flags AUTH_REFRESH_FAILED extension code', () => {
      const err = combinedError([
        {
          message: 'Failed to refresh SSO access token',
          extensions: { code: 'AUTH_REFRESH_FAILED' },
        },
      ])
      expect(isAuthLostError(err)).toBe(true)
    })

    it('flags NOT_LOGGED_IN extension code', () => {
      const err = combinedError([
        { message: 'Not logged in', extensions: { code: 'NOT_LOGGED_IN' } },
      ])
      expect(isAuthLostError(err)).toBe(true)
    })

    it('flags legacy Token invalid message', () => {
      const err = combinedError([{ message: 'Token invalid.' }])
      expect(isAuthLostError(err)).toBe(true)
    })

    it('flags legacy Failed to refresh message (no extension)', () => {
      const err = combinedError([{ message: 'Failed to refresh SSO access token' }])
      expect(isAuthLostError(err)).toBe(true)
    })

    it('does not flag unrelated errors', () => {
      const err = combinedError([
        { message: 'something else', extensions: { code: 'INTERNAL_SERVER_ERROR' } },
      ])
      expect(isAuthLostError(err)).toBe(false)
    })
  })

  describe('isOnlyNotLoggedIn', () => {
    it('true when every error is NOT_LOGGED_IN', () => {
      const err = combinedError([
        { message: 'Not logged in', extensions: { code: 'NOT_LOGGED_IN' } },
      ])
      expect(isOnlyNotLoggedIn(err)).toBe(true)
    })

    it('false when any error is something else', () => {
      const err = combinedError([
        { message: 'Not logged in', extensions: { code: 'NOT_LOGGED_IN' } },
        {
          message: 'Failed to refresh',
          extensions: { code: 'AUTH_REFRESH_FAILED' },
        },
      ])
      expect(isOnlyNotLoggedIn(err)).toBe(false)
    })

    it('false when there are no graphQL errors', () => {
      const err = combinedError([])
      expect(isOnlyNotLoggedIn(err)).toBe(false)
    })
  })
})
