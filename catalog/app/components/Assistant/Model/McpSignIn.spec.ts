import * as Eff from 'effect'
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: { registryUrl: 'https://registry.test' } }))

const captureException = vi.hoisted(() => vi.fn())
vi.mock('@sentry/react', () => ({ captureException }))
vi.mock('urql', () => ({
  useClient: () => ({ query: () => ({ toPromise: async () => ({}) }) }),
}))
vi.mock('utils/GraphQL', () => ({ useMutation: () => vi.fn() }))
vi.mock('utils/Effect', async () => {
  const E = await import('effect')
  return { runtime: { runFork: (eff: any) => E.Effect.runFork(eff) } }
})

import * as Connectors from './Connectors'
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
  vi.fn<typeof globalThis.fetch>(async (url) =>
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

  it('refuses an authorize URL that is not https', async () => {
    const { win, popup } = fakeWindow()
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json({ authorizeUrl: 'javascript:alert(1)' }),
    )
    await expect(start(win, fetch as any)).resolves.toEqual({
      ok: false,
      reason: 'failed',
      error: 'InvalidAuthorizeUrl',
    })
    expect(popup.location.href).toBe('')
    expect(popup.close).toHaveBeenCalled()
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

  it.each([
    [404, 'NotFound', 'notAvailable'],
    [503, 'NeedsClientCredentials', 'needsClientCredentials'],
    [503, 'NotAvailable', 'notAvailable'],
    [429, 'Busy', 'busy'],
  ])('start %i %s closes the popup as %s', async (status, code, reason) => {
    const { win, popup } = fakeWindow()
    const fetch = vi.fn(async () => json({ error_code: code }, status))
    await expect(start(win, fetch as any)).resolves.toEqual({ ok: false, reason })
    expect(popup.close).toHaveBeenCalled()
  })

  it.each([
    [400, 'SignInFailed', 'signInFailed'],
    [401, 'NeedsSignIn', 'signInFailed'],
  ])('finish %i %s is reported as %s', async (status, code, reason) => {
    const { win, post } = fakeWindow()
    const result = start(
      win,
      registry(() => json({ error_code: code }, status)),
    )
    await flush()
    post(callback())
    await expect(result).resolves.toEqual({ ok: false, reason })
  })

  it('an unknown code is reported with the code', async () => {
    const { win } = fakeWindow()
    const fetch = vi.fn(async () => json({ error_code: 'Weird' }, 500))
    await expect(start(win, fetch as any)).resolves.toEqual({
      ok: false,
      reason: 'failed',
      error: 'Weird',
    })
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
  let retries = 0
  const makeConnectors = (initial: Connectors.ConnectorState) => {
    const state = Eff.Effect.runSync(Eff.SubscriptionRef.make(initial))
    const retry = Eff.Effect.sync(() => void (retries += 1))
    return { state, service: { byId: { slack: { state, retry } } } as any }
  }
  const failed = Connectors.ConnectorState.Failed({
    error: { _tag: 'Auth', message: 'sign in', needsSignIn: true },
    acked: false,
  })

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
    retries = 0
    cleanup()
  })

  const reply = () =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: callback(),
        origin: REGISTRY,
        source: popup as unknown as Window,
      }),
    )

  const getToken = () => Eff.Effect.succeed('tok')
  function mount(service: Connectors.ConnectorsService) {
    const result = { current: null as unknown as ReturnType<typeof useMcpSignIn> }
    function Probe() {
      result.current = useMcpSignIn(servers, service, getToken)
      return null
    }
    const view = render(React.createElement(Probe))
    return Object.assign(result, { unmount: view.unmount })
  }

  it('holds the reconnect until a connection attempt in flight settles', async () => {
    window.fetch = registry() as any
    const { state, service } = makeConnectors(Connectors.ConnectorState.Connecting())
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await flush()
      reply()
      await flush()
      await flush()
    })
    expect(result.current.status).toBe('Connected Slack.')
    expect(retries).toBe(0)
    await act(async () => {
      Eff.Effect.runSync(Eff.SubscriptionRef.set(state, failed))
      await flush()
    })
    expect(retries).toBe(1)
  })

  it('closes the popup and drops the flow when the hook unmounts', async () => {
    const fetch = registry()
    window.fetch = fetch as any
    const { service } = makeConnectors(failed)
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await flush()
    })
    result.unmount()
    reply()
    await flush()
    expect(popup.close).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(retries).toBe(0)
  })

  it('a sign-in takes a real needs-sign-in connector to Ready', async () => {
    window.fetch = registry() as any
    let signedIn = false
    const backend: Connectors.Backend = {
      initialize: () =>
        signedIn
          ? Eff.Effect.void
          : Eff.Effect.fail({ _tag: 'Auth', message: 'sign in', needsSignIn: true }),
      listTools: () => Eff.Effect.succeed([]),
      listResources: () => Eff.Effect.succeed([]),
      readResource: () => Eff.Effect.succeed(''),
      callTool: () => Eff.Effect.die('unused'),
      ping: () => Eff.Effect.void,
    }
    const scope = Eff.Effect.runSync(Eff.Scope.make())
    const service = await Eff.Effect.runPromise(
      Connectors.buildService([
        { id: 'slack', title: 'Slack', optional: true, backend },
      ]).pipe(Eff.Effect.provideService(Eff.Scope.Scope, scope)),
    )
    const state = service.byId.slack.state
    const settled = (tag: string) =>
      Eff.Effect.runPromise(
        state.changes.pipe(
          Eff.Stream.filter((s) => s._tag === tag),
          Eff.Stream.take(1),
          Eff.Stream.runDrain,
        ),
      )
    await settled('Failed')
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await flush()
      signedIn = true
      reply()
      await flush()
      await flush()
      await settled('Ready')
    })
    expect(result.current.status).toBe('Connected Slack.')
    await Eff.Effect.runPromise(Eff.Scope.close(scope, Eff.Exit.void))
  })

  it('a popup closed with no message leaves Connect available again', async () => {
    vi.useFakeTimers()
    window.fetch = registry() as any
    const { service } = makeConnectors(failed)
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(result.current.pending).toBe('slack')
    popup.closed = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    vi.useRealTimers()
    await act(async () => {
      await flush()
    })
    expect(result.current.pending).toBeNull()
    expect(result.current.status).toBe(
      'The Slack sign-in window was closed before you finished.',
    )
    expect(retries).toBe(0)
  })

  it('shows SignInFailed without a reconnect, and never reports the code', async () => {
    window.fetch = registry(() => json({ error_code: 'SignInFailed' }, 400)) as any
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { service } = makeConnectors(failed)
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await flush()
      reply()
      await flush()
      await flush()
    })
    expect(result.current.status).toBe('Slack sign-in failed, try again.')
    expect(retries).toBe(0)
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
