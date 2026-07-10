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
// tokens: false -> no credential attached (authAttached === false).
const drive = ({ handleInvalidToken = true, tokens = { token: 't' } as any } = {}) =>
  authMiddleware(
    { auth: { tokens, handleInvalidToken }, endpoint: '/x' } as any,
    (() => {}) as any,
  )

const httpError = (status: number) => new (HTTPError as any)(status, { message: 'nope' })

describe('containers/Auth/apiMiddleware', () => {
  it('redirects (authLost + rethrow) on a 401 whose request carried a credential', () => {
    const e = httpError(401)
    const gen = drive() // tokens provided -> authAttached true -> decideAuthLoss = redirect
    gen.next() // yield call(next)
    gen.throw(e) // catch -> yield select(authenticated)
    gen.next(false) // -> yield select(waiting)
    const step = gen.next(false) // authAttached true -> redirect -> yield put(authLost)
    expect(step.done).toBe(false)
    expect(step.value).toEqual(put(authLost(new InvalidToken({ originalError: e }))))
    expect(() => gen.next()).toThrow(e) // after the put, e is rethrown
  })

  it('holds (no authLost) a no-credential 401 while a session already exists', () => {
    const e = httpError(401)
    const gen = drive({ tokens: false }) // authAttached false
    gen.next() // yield call(next)
    gen.throw(e) // -> yield select(authenticated)
    gen.next(true) // authenticated=true -> yield select(waiting)
    expect(() => gen.next(false)).toThrow(e) // decideAuthLoss -> hold -> no put, straight rethrow
  })

  it('does not dispatch when handleInvalidToken is false', () => {
    const e = httpError(401)
    const gen = drive({ handleInvalidToken: false })
    gen.next()
    expect(() => gen.throw(e)).toThrow(e) // guard false -> no selects, straight rethrow
  })

  it('does not dispatch on a non-401 (e.g. 403)', () => {
    const e = httpError(403)
    const gen = drive()
    gen.next()
    expect(() => gen.throw(e)).toThrow(e) // not auth-loss -> no selects, rethrow
  })
})
