import { describe, it, expect, vi } from 'vitest'
import { put } from 'redux-saga/effects'

// APIConnector and saga eagerly pull in constants/config (which requires a
// window catalog config at import time); mock both so this stays a focused
// unit test of authMiddleware's control flow. The HTTPError stub mirrors the
// real `is` (instanceof + status + optional message).
vi.mock('utils/APIConnector', () => {
  class HTTPError extends Error {
    status: number
    json: any
    constructor(status: number, json: any) {
      super('http')
      this.status = status
      this.json = json
    }
    static is(e: any, status?: number, msg?: string) {
      if (!(e instanceof HTTPError)) return false
      if (status && e.status !== status) return false
      if (msg && !(e.json && e.json.message === msg)) return false
      return true
    }
  }
  return { HTTPError }
})
// getTokens is not reached (tokens are provided explicitly below), so a plain
// stub suffices — it only needs to be importable.
vi.mock('./saga', () => ({ getTokens: () => undefined }))

import { HTTPError } from 'utils/APIConnector'
import authMiddleware from './apiMiddleware'
import { authLost } from './actions'
import { InvalidToken } from './errors'

// Pass tokens explicitly so the middleware does not call getTokens; then drive
// the generator to `yield call(next)` and inject the failure via throw.
const drive = (handleInvalidToken: boolean) =>
  authMiddleware(
    { auth: { tokens: { token: 't' }, handleInvalidToken }, endpoint: '/x' } as any,
    (() => {}) as any,
  )

const httpError = (status: number) => new (HTTPError as any)(status, { message: 'nope' })

describe('containers/Auth/apiMiddleware', () => {
  it('dispatches authLost on a 401, then rethrows', () => {
    const e = httpError(401)
    const gen = drive(true)
    gen.next() // -> yield call(next, nextOpts)
    const step = gen.throw(e) // catch -> yield put(authLost(...))
    expect(step.done).toBe(false)
    expect(step.value).toEqual(put(authLost(new InvalidToken({ originalError: e }))))
    expect(() => gen.next()).toThrow(e) // after the put, e is rethrown
  })

  it('does not dispatch when handleInvalidToken is false', () => {
    const e = httpError(401)
    const gen = drive(false)
    gen.next()
    expect(() => gen.throw(e)).toThrow(e) // straight rethrow, no put
  })

  it('does not dispatch on a non-401 (e.g. 403)', () => {
    const e = httpError(403)
    const gen = drive(true)
    gen.next()
    expect(() => gen.throw(e)).toThrow(e) // not auth-loss, no put
  })
})
