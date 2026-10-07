import * as Eff from 'effect'
import * as React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: { registryUrl: 'https://registry.test' } }))

const captureException = vi.hoisted(() => vi.fn())
vi.mock('@sentry/react', () => ({ captureException }))
vi.mock('urql', () => ({
  useClient: () => ({ query: () => ({ toPromise: async () => ({}) }) }),
}))
vi.mock('utils/GraphQL', () => ({ useMutation: () => vi.fn() }))
const runFork = vi.hoisted(() => vi.fn())
vi.mock('utils/Effect', () => ({ runtime: { runFork } }))

import { signIn, useMcpSignIn } from './McpSignIn'

const REGISTRY = 'https://registry.test'
const CODE = 'secret-auth-code'
const STATE = 'secret-state'

function fakeWindow() {
  const popup = { closed: false, close: vi.fn(), location: { href: '' } }
  const target = new EventTarget()
  const win = {
    open: vi.fn(() => popup),
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: number) => clearInterval(id),
  }
  const post = (data: unknown, origin = REGISTRY, source: unknown = popup) =>
    target.dispatchEvent(Object.assign(new Event('message'), { data, origin, source }))
  return { win: win as unknown as Window, popup, post }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

/** The registry: start answers with an authorize URL, finish with `finish`. */
const registry = (finish: () => Response = () => json({ ok: true })) =>
  vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith('/start')
      ? json({ authorizeUrl: 'https://provider.test/authorize?x=1' })
      : finish(),
  )

const callback = (extra: object = {}) => ({
  type: 'quilt-mcp-oauth',
  slug: 'slack',
  ok: true,
  code: CODE,
  state: STATE,
  ...extra,
})

const flush = () => new Promise((r) => setTimeout(r, 0))

const start = (win: Window, fetch: ReturnType<typeof registry>) =>
  signIn({
    slug: 'slack',
    registryUrl: REGISTRY,
    getToken: async () => 'tok',
    win,
    fetch,
  })

describe('components/Assistant/Model/McpSignIn signIn', () => {
  beforeEach(() => vi.useRealTimers())
  afterEach(() => vi.useRealTimers())

  it('opens the authorize URL, then finishes with the exact code, state and iss', async () => {
    const { win, popup, post } = fakeWindow()
    const fetch = registry()
    const result = start(win, fetch)
    await flush()
    expect(fetch.mock.calls[0]).toEqual([
      `${REGISTRY}/api/mcp/slack/oauth/start`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    ])
    expect(popup.location.href).toBe('https://provider.test/authorize?x=1')
    post(callback({ iss: 'https://slack.com' }))
    await expect(result).resolves.toEqual({ ok: true })
    expect(fetch.mock.calls[1]).toEqual([
      `${REGISTRY}/api/mcp/slack/oauth/finish`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: CODE, state: STATE, iss: 'https://slack.com' }),
      },
    ])
  })

  it('omits iss from finish when the provider sent none', async () => {
    const { win, post } = fakeWindow()
    const fetch = registry()
    const result = start(win, fetch)
    await flush()
    post(callback())
    await result
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({
      code: CODE,
      state: STATE,
    })
  })

  it('ignores a message from the wrong origin, the wrong window or another slug', async () => {
    const { win, post } = fakeWindow()
    const fetch = registry()
    let settled = false
    const result = start(win, fetch).then((r) => {
      settled = true
      return r
    })
    await flush()
    post(callback(), 'https://evil.test')
    post(callback(), REGISTRY, {})
    post(callback({ slug: 'fathom' }))
    await flush()
    expect(settled).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    post(callback())
    await expect(result).resolves.toEqual({ ok: true })
  })

  it('handles only the first callback for a popup', async () => {
    const { win, post } = fakeWindow()
    const fetch = registry()
    const result = start(win, fetch)
    await flush()
    post(callback())
    post(callback({ code: 'second' }))
    await result
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reports SignInFailed from finish', async () => {
    const { win, post } = fakeWindow()
    const result = start(
      win,
      registry(() => json({ error_code: 'SignInFailed' }, 400)),
    )
    await flush()
    post(callback())
    await expect(result).resolves.toEqual({ ok: false, reason: 'signInFailed' })
  })

  it('reports a declined sign-in without calling finish', async () => {
    const { win, post } = fakeWindow()
    const fetch = registry()
    const result = start(win, fetch)
    await flush()
    post({ type: 'quilt-mcp-oauth', slug: 'slack', ok: false, error: 'denied' })
    await expect(result).resolves.toEqual({ ok: false, reason: 'denied' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reports a blocked popup without calling the registry', async () => {
    const { win } = fakeWindow()
    ;(win.open as any).mockReturnValue(null)
    const fetch = registry()
    await expect(start(win, fetch)).resolves.toEqual({ ok: false, reason: 'blocked' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports a popup the user closed', async () => {
    vi.useFakeTimers()
    const { win, popup } = fakeWindow()
    const result = start(win, registry())
    popup.closed = true
    await vi.advanceTimersByTimeAsync(600)
    await expect(result).resolves.toEqual({ ok: false, reason: 'closed' })
  })

  it('closes the popup and reports the registry error code when start fails', async () => {
    const { win, popup } = fakeWindow()
    const fetch = vi.fn(async () => json({ error_code: 'NeedsClientCredentials' }, 503))
    await expect(start(win, fetch as any)).resolves.toEqual({
      ok: false,
      reason: 'failed',
      error: 'NeedsClientCredentials',
    })
    expect(popup.close).toHaveBeenCalled()
  })
})

describe('components/Assistant/Model/McpSignIn useMcpSignIn', () => {
  const servers = [
    {
      __typename: 'McpServer' as const,
      slug: 'slack',
      title: 'Slack',
      hint: null,
      trusted: false,
      auth: 'OAUTH' as any,
      signedIn: false,
    },
  ]
  const connectors = { byId: { slack: { retry: 'retry-slack' } } } as any

  let originalOpen: typeof window.open
  let originalFetch: typeof window.fetch
  let popup: { closed: boolean; close: () => void; location: { href: string } }

  beforeEach(() => {
    originalOpen = window.open
    originalFetch = window.fetch
    popup = { closed: false, close: vi.fn(), location: { href: '' } }
    window.open = vi.fn(() => popup) as any
  })

  afterEach(() => {
    window.open = originalOpen
    window.fetch = originalFetch
    captureException.mockReset()
    runFork.mockReset()
  })

  const reply = () =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: callback(),
        origin: REGISTRY,
        source: popup as unknown as Window,
      }),
    )

  it('shows SignInFailed, reconnects the connector, and never reports the code', async () => {
    window.fetch = registry(() => json({ error_code: 'SignInFailed' }, 400)) as any
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const getToken = () => Eff.Effect.succeed('tok')
    const result = { current: null as unknown as ReturnType<typeof useMcpSignIn> }
    function Probe() {
      result.current = useMcpSignIn(servers, connectors, getToken)
      return null
    }
    render(React.createElement(Probe))
    await act(async () => {
      result.current.connect('slack')
      await flush()
      reply()
      await flush()
      await flush()
    })
    expect(result.current.status).toBe('Slack sign-in failed, try again.')
    expect(runFork).toHaveBeenCalledWith('retry-slack')
    const reported = JSON.stringify([
      captureException.mock.calls,
      log.mock.calls,
      warn.mock.calls,
      result.current.status,
    ])
    expect(reported).not.toContain(CODE)
    expect(reported).not.toContain(STATE)
    log.mockRestore()
    warn.mockRestore()
  })
})
