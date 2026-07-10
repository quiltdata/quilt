import { describe, it, expect } from 'vitest'

import { decideAuthLoss } from './authLoss'

const decide = (over: Partial<Parameters<typeof decideAuthLoss>[0]>) =>
  decideAuthLoss({ authAttached: false, authenticated: false, waiting: false, ...over })

describe('containers/Auth/authLoss', () => {
  describe('decideAuthLoss', () => {
    it('redirects when a credential was sent (dead session), regardless of state', () => {
      expect(decide({ authAttached: true })).toBe('redirect')
      expect(decide({ authAttached: true, waiting: true })).toBe('redirect')
      expect(decide({ authAttached: true, authenticated: true })).toBe('redirect')
    })
    it('holds a no-credential 401 while a sign-in handshake is in flight', () => {
      expect(decide({ authAttached: false, waiting: true })).toBe('hold')
    })
    it('holds a no-credential 401 once a session already exists (late straggler)', () => {
      expect(decide({ authAttached: false, authenticated: true })).toBe('hold')
    })
    it('redirects a no-credential 401 with no session and no sign-in in flight', () => {
      expect(decide({})).toBe('redirect')
    })
  })
})
