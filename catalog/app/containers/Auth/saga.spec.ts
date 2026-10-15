import { describe, it, expect, vi } from 'vitest'
import { call } from 'redux-saga/effects'

// Mirrors apiMiddleware.spec.ts's HTTPError stub: eagerly-imported modules
// (constants/config via APIConnector) are mocked so this stays a focused
// unit test of the signup saga functions' control flow.
vi.mock('utils/APIConnector', () => {
  class HTTPError extends Error {
    status: number
    json: any
    constructor(status: number, json: any) {
      super('http')
      this.status = status
      this.json = json
    }
    static is(e: any, status?: number, msg?: string | RegExp) {
      if (!(e instanceof HTTPError)) return false
      if (status && e.status !== status) return false
      if (msg) {
        const message = e.json && e.json.message
        if (typeof msg === 'string' && message !== msg) return false
        if (msg instanceof RegExp && !msg.test(message)) return false
      }
      return true
    }
  }
  return { HTTPError, apiRequest: vi.fn() }
})

import { HTTPError } from 'utils/APIConnector'
import * as errors from './errors'
import {
  getSignupPage,
  codeSignupRedeem,
  codeSignupComplete,
  handleGetSignupPage,
  handleCodeSignupRedeem,
  handleCodeSignupComplete,
} from './saga'

const httpError = (status: number, json: any = {}) => new (HTTPError as any)(status, json)

// Starts a one-shot generator, advancing it to its single `yield call(...)`.
const start = (gen: Generator<any, any, any>) => gen.next()

// Injects an error at the generator's current yield point (its `yield call(...)`)
// and returns what it throws back out, after its own try/catch remaps it.
const throwInto = (gen: Generator<any, any, any>, error: any) => {
  try {
    gen.throw(error)
    return { thrown: undefined }
  } catch (e) {
    return { thrown: e }
  }
}

describe('containers/Auth/saga: signup', () => {
  describe('getSignupPage', () => {
    it('calls the signup page endpoint and returns its result', () => {
      const gen = getSignupPage('benchtalk')
      const step = start(gen)
      expect(step.value.payload.args).toEqual([
        { auth: false, endpoint: '/signup/benchtalk' },
      ])
      const info = { title: 'BenchTalk', description: 'Hi' }
      const final = gen.next(info)
      expect(final).toEqual({ value: info, done: true })
    })

    it('maps a 404 to SignupPageNotFound', () => {
      const gen = getSignupPage('nope')
      start(gen)
      const { thrown } = throwInto(gen, httpError(404))
      expect(thrown).toBeInstanceOf(errors.SignupPageNotFound)
    })

    it('wraps any other error as AuthError', () => {
      const gen = getSignupPage('benchtalk')
      start(gen)
      const { thrown } = throwInto(gen, httpError(500))
      expect(thrown).toBeInstanceOf(errors.AuthError)
      expect(thrown).not.toBeInstanceOf(errors.SignupPageNotFound)
    })
  })

  describe('codeSignupRedeem', () => {
    it('maps an invalid-code 401 to SignupCodeInvalid', () => {
      const gen = codeSignupRedeem({ page: 'benchtalk', code: 'wrong' })
      start(gen)
      const { thrown } = throwInto(gen, httpError(401, { message: 'Invalid code' }))
      expect(thrown).toBeInstanceOf(errors.SignupCodeInvalid)
    })

    it('wraps any other error as AuthError', () => {
      const gen = codeSignupRedeem({ page: 'benchtalk', code: 'x' })
      start(gen)
      const { thrown } = throwInto(gen, httpError(500))
      expect(thrown).toBeInstanceOf(errors.AuthError)
      expect(thrown).not.toBeInstanceOf(errors.SignupCodeInvalid)
    })
  })

  describe('codeSignupComplete', () => {
    const params = {
      page: 'benchtalk',
      ticket: 't',
      username: 'u',
      email: 'e@x.com',
      password: 'password123',
    }

    it('maps an invalid/expired ticket 401 to SignupTicketInvalid', () => {
      const gen = codeSignupComplete(params)
      start(gen)
      const { thrown } = throwInto(
        gen,
        httpError(401, { message: 'Invalid or expired signup ticket' }),
      )
      expect(thrown).toBeInstanceOf(errors.SignupTicketInvalid)
    })

    it('maps an SMTP-invalid 500 to SMTPError (not covered by registrationError)', () => {
      const gen = codeSignupComplete(params)
      start(gen)
      const { thrown } = throwInto(
        gen,
        httpError(500, { message: 'SMTP config invalid' }),
      )
      expect(thrown).toBeInstanceOf(errors.SMTPError)
    })

    it('maps a password-auth-disabled 401 to PasswordAuthDisabled (shared registrationError)', () => {
      const gen = codeSignupComplete(params)
      start(gen)
      const { thrown } = throwInto(
        gen,
        httpError(401, { message: 'password authentication disabled' }),
      )
      expect(thrown).toBeInstanceOf(errors.PasswordAuthDisabled)
    })

    it('maps a taken-username 409 to UsernameTaken (shared registrationError)', () => {
      const gen = codeSignupComplete(params)
      start(gen)
      const { thrown } = throwInto(
        gen,
        httpError(409, { message: 'Username already taken.' }),
      )
      expect(thrown).toBeInstanceOf(errors.UsernameTaken)
    })

    it('wraps an unrecognized error as AuthError', () => {
      const gen = codeSignupComplete(params)
      start(gen)
      const { thrown } = throwInto(gen, httpError(500))
      expect(thrown).toBeInstanceOf(errors.AuthError)
      expect(thrown).not.toBeInstanceOf(errors.SignupTicketInvalid)
    })
  })

  describe('handler sagas resolve/reject the caller', () => {
    const makeMeta = () => {
      const resolve = vi.fn()
      const reject = vi.fn()
      return { meta: { resolve, reject }, resolve, reject }
    }

    it('handleGetSignupPage calls resolve on success', () => {
      const { meta, resolve, reject } = makeMeta()
      const gen = handleGetSignupPage({ payload: 'benchtalk', meta } as any)
      gen.next()
      const info = { title: 'BenchTalk', description: null }
      const step = gen.next(info)
      expect(step.value).toEqual(call(resolve, info))
      expect(reject).not.toHaveBeenCalled()
    })

    it('handleGetSignupPage calls reject on failure', () => {
      const { meta, resolve, reject } = makeMeta()
      const gen = handleGetSignupPage({ payload: 'benchtalk', meta } as any)
      gen.next()
      const err = new errors.SignupPageNotFound({})
      const step = gen.throw(err)
      expect(step.value).toEqual(call(reject, err))
      expect(resolve).not.toHaveBeenCalled()
    })

    it('handleCodeSignupRedeem calls resolve on success', () => {
      const { meta, resolve, reject } = makeMeta()
      const gen = handleCodeSignupRedeem({
        payload: { page: 'benchtalk', code: 'x' },
        meta,
      } as any)
      gen.next()
      const step = gen.next('ticket-value')
      expect(step.value).toEqual(call(resolve, 'ticket-value'))
      expect(reject).not.toHaveBeenCalled()
    })

    it('handleCodeSignupRedeem calls reject on failure', () => {
      const { meta, resolve, reject } = makeMeta()
      const gen = handleCodeSignupRedeem({
        payload: { page: 'benchtalk', code: 'x' },
        meta,
      } as any)
      gen.next()
      const err = new errors.SignupCodeInvalid({})
      const step = gen.throw(err)
      expect(step.value).toEqual(call(reject, err))
      expect(resolve).not.toHaveBeenCalled()
    })

    it('handleCodeSignupComplete calls resolve on success', () => {
      const { meta, resolve, reject } = makeMeta()
      const gen = handleCodeSignupComplete({
        payload: { page: 'benchtalk', ticket: 't', username: 'u', email: 'e@x.com' },
        meta,
      } as any)
      gen.next()
      const step = gen.next(undefined)
      expect(step.value).toEqual(call(resolve))
      expect(reject).not.toHaveBeenCalled()
    })

    it('handleCodeSignupComplete calls reject on failure', () => {
      const { meta, resolve, reject } = makeMeta()
      const gen = handleCodeSignupComplete({
        payload: { page: 'benchtalk', ticket: 't', username: 'u', email: 'e@x.com' },
        meta,
      } as any)
      gen.next()
      const err = new errors.SignupTicketInvalid({})
      const step = gen.throw(err)
      expect(step.value).toEqual(call(reject, err))
      expect(resolve).not.toHaveBeenCalled()
    })
  })
})
