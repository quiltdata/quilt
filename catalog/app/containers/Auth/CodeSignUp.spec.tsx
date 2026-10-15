import { fromJS } from 'immutable'
import * as React from 'react'
import * as redux from 'react-redux'
import { MemoryRouter, Route, Switch } from 'react-router-dom'
import { createStore, applyMiddleware } from 'redux'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as NamedRoutes from 'utils/NamedRoutes'
import * as routes from 'constants/routes'

const cfg = vi.hoisted(() => ({
  passwordAuth: true as boolean,
  ssoAuth: true as boolean,
  ssoProviders: [] as string[],
}))
vi.mock('constants/config', () => ({ default: cfg }))
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))
vi.mock('components/Layout', () => ({
  default: ({ children }: React.PropsWithChildren<{}>) => <>{children}</>,
}))
// The identity provider's popup: it hands back an authorization code.
vi.mock('utils/OIDC', () => ({
  use: () => async () => 'oidc-code',
  OIDCError: class OIDCError extends Error {},
}))

import CodeSignUp from './CodeSignUp'
import { actions as types, REDUX_KEY } from './constants'
import * as errors from './errors'

const SIGNED_IN = 'test/SIGNED_IN'

// Stands in for the registry behind the auth saga: answers each request through the
// resolver the component passed with it.
function mkStore(signIn: (payload: any) => Error | null) {
  const logins: any[] = []
  const registry = (store: any) => (next: any) => (action: any) => {
    const { resolve, reject } = action.meta || {}
    switch (action.type) {
      case types.GET_SIGNUP_PAGE:
        resolve({ title: 'BenchTalk', description: null })
        return undefined
      case types.CODE_SIGNUP_REDEEM:
        resolve('ticket-1')
        return undefined
      case types.SIGN_IN: {
        logins.push(action.payload)
        const error = signIn(action.payload)
        if (error) {
          reject(error)
        } else {
          store.dispatch({ type: SIGNED_IN })
          resolve({})
        }
        return undefined
      }
      default:
        return next(action)
    }
  }
  const reducer = (state = fromJS({}), action: any) =>
    action.type === SIGNED_IN
      ? fromJS({ [REDUX_KEY]: { user: { current_user: 'visitor' } } })
      : state
  return { store: createStore(reducer, applyMiddleware(registry)), logins }
}

function renderPage(signIn: (payload: any) => Error | null = () => null) {
  const { store, logins } = mkStore(signIn)
  const utils = render(
    <redux.Provider store={store}>
      <MemoryRouter initialEntries={['/signup/benchtalk?code=abc']}>
        <NamedRoutes.Provider routes={routes}>
          <Switch>
            <Route path="/signup/:page">
              <CodeSignUp />
            </Route>
            <Route path="/" exact>
              Home page
            </Route>
          </Switch>
        </NamedRoutes.Provider>
      </MemoryRouter>
    </redux.Provider>,
  )
  return { ...utils, logins }
}

async function redeem({ findByRole }: ReturnType<typeof renderPage>) {
  fireEvent.click(await findByRole('button', { name: 'Continue' }))
}

// The auth fields' labels are not linked to their inputs, so find inputs by name.
const field = ({ container }: ReturnType<typeof renderPage>, name: string) =>
  container.querySelector(`input[name="${name}"]`)

describe('containers/Auth/CodeSignUp signup methods', () => {
  beforeEach(() => {
    cfg.passwordAuth = true
    cfg.ssoAuth = true
    cfg.ssoProviders = ['google', 'okta']
  })

  afterEach(cleanup)

  it("offers the stack's SSO providers and the email form", async () => {
    const page = renderPage()
    await redeem(page)
    expect(await page.findByRole('button', { name: 'Continue with Google' })).toBeTruthy()
    expect(page.getByRole('button', { name: 'Continue with Okta' })).toBeTruthy()
    expect(page.queryAllByRole('button', { name: /OneLogin|Microsoft/ })).toHaveLength(0)
    expect(field(page, 'username')).toBeTruthy()
  })

  it('offers no SSO where SSO is disabled', async () => {
    cfg.ssoAuth = false
    const page = renderPage()
    await redeem(page)
    expect(await page.findByRole('button', { name: 'Sign up' })).toBeTruthy()
    expect(field(page, 'username')).toBeTruthy()
    expect(page.queryAllByRole('button', { name: /^Continue with/ })).toHaveLength(0)
  })

  it('hides the email form where password signup is disabled', async () => {
    cfg.passwordAuth = false
    const page = renderPage()
    await redeem(page)
    expect(await page.findByRole('button', { name: 'Continue with Google' })).toBeTruthy()
    expect(field(page, 'username')).toBeNull()
  })

  it('says so, without asking for the code, where no signup method is enabled', async () => {
    cfg.passwordAuth = false
    cfg.ssoAuth = false
    const page = renderPage()
    expect(await page.findByText(/No signup method is enabled/)).toBeTruthy()
    expect(field(page, 'code')).toBeNull()
  })

  it('sends the ticket with the SSO login and lands the visitor home', async () => {
    const page = renderPage()
    await redeem(page)
    fireEvent.click(await page.findByRole('button', { name: 'Continue with Google' }))
    expect(await page.findByText('Home page')).toBeTruthy()
    expect(page.logins).toEqual([
      {
        provider: 'google',
        code: 'oidc-code',
        signup_page: 'benchtalk',
        signup_ticket: 'ticket-1',
      },
    ])
  })

  it('returns to code entry when the registry refuses the ticket', async () => {
    const page = renderPage(() => new errors.SignupTicketInvalid())
    await redeem(page)
    fireEvent.click(await page.findByRole('button', { name: 'Continue with Okta' }))
    expect(await page.findByText(/This signup link has expired/)).toBeTruthy()
    expect(field(page, 'code')).toBeTruthy()
    expect(page.queryAllByRole('button', { name: /^Continue with/ })).toHaveLength(0)
  })
})
