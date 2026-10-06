import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

import { OIDCError, takeRedirectResult } from './OIDC'

const PENDING = 'QUILT_OIDC_REDIRECT'
const CALLBACK = 'QUILT_OIDC_CALLBACK'
const pend = (state: string, next?: string, ts = Date.now()) =>
  localStorage.setItem(PENDING, JSON.stringify({ provider: 'google', state, next, ts }))
const callback = (search: string) => localStorage.setItem(CALLBACK, search)

describe('utils/OIDC takeRedirectResult', () => {
  beforeEach(() => localStorage.clear())

  it('ignores a sign-in page with no stored callback', () => {
    pend('s1')
    expect(takeRedirectResult()).toBeNull()
    expect(localStorage.getItem(PENDING)).not.toBeNull()
  })

  it('returns the code, provider and next for a matching state, once', () => {
    pend('s1', '/qurator')
    callback('?code=c&state=s1')
    expect(takeRedirectResult()).toEqual({
      provider: 'google',
      code: 'c',
      next: '/qurator',
    })
    expect(takeRedirectResult()).toBeNull()
    expect(localStorage.getItem(PENDING)).toBeNull()
  })

  it('rejects a mismatched state and consumes the pending entry', () => {
    pend('s1', '/qurator')
    callback('?code=c&state=forged')
    const result = takeRedirectResult()
    expect(result).toMatchObject({ next: '/qurator' })
    expect(result).not.toHaveProperty('code')
    expect(result?.error).toBeInstanceOf(OIDCError)
    expect(localStorage.getItem(PENDING)).toBeNull()
  })

  it('rejects a callback with no pending entry', () => {
    callback('?code=c&state=s1')
    const result = takeRedirectResult()
    expect(result).not.toHaveProperty('code')
    expect(result?.error).toBeInstanceOf(OIDCError)
  })

  it('rejects a pending entry older than ten minutes', () => {
    pend('s1', '/qurator', Date.now() - 11 * 60 * 1000)
    callback('?code=c&state=s1')
    const result = takeRedirectResult()
    expect(result).not.toHaveProperty('code')
    expect(result?.error).toBeInstanceOf(OIDCError)
  })

  it('surfaces an IdP error', () => {
    pend('s1')
    callback('?error=access_denied&state=s1')
    expect(takeRedirectResult()?.error).toBeInstanceOf(OIDCError)
  })
})
