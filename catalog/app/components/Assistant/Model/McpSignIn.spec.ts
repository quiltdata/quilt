import * as Eff from 'effect'
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: { registryUrl: 'https://registry.test' } }))

const captureException = vi.hoisted(() => vi.fn())
vi.mock('@sentry/react', () => ({ captureException }))
const refetch = vi.hoisted(() => ({
  current: async (): Promise<unknown> => ({}),
  calls: 0,
}))
vi.mock('urql', () => ({
  useClient: () => ({
    query: () => ({
      toPromise: () => {
        refetch.calls += 1
        return refetch.current()
      },
    }),
  }),
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
    channelFactory: undefined as unknown,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: number) => clearInterval(id),
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: number) => clearTimeout(id),
  }
  const channel = {
    onmessage: null as ((e: MessageEvent) => void) | null,
    close: vi.fn(),
  }
  const post = (data: unknown) => channel.onmessage?.({ data } as MessageEvent)
  const legacy = (data: unknown) =>
    target.dispatchEvent(Object.assign(new Event('message'), { data }))
  win.channelFactory = () => channel
  return {
    win: win as unknown as Window,
    popup,
    post,
    legacy,
    channel,
    openChannel: () => channel,
  }
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
      ? json({ authorizeUrl: `https://provider.test/authorize?x=1&state=${STATE}` })
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

const start = (
  win: Window,
  fetch: ReturnType<typeof registry>,
  extra: Partial<Parameters<typeof signIn>[0]> = {},
) =>
  signIn({
    slug: 'slack',
    registryUrl: REGISTRY,
    getToken: async () => 'tok',
    win,
    fetch,
    openChannel: (win as any).channelFactory,
    ...extra,
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
      {
        method: 'POST',
        headers: { Authorization: 'Bearer tok' },
        signal: expect.any(AbortSignal),
      },
    ])
    expect(popup.location.href).toBe(`https://provider.test/authorize?x=1&state=${STATE}`)
    post(callback({ iss: 'https://slack.com' }))
    await expect(result).resolves.toEqual({ ok: true })
    expect(fetch.mock.calls[1]).toEqual([
      `${REGISTRY}/api/mcp/slack/oauth/finish`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: CODE, state: STATE, iss: 'https://slack.com' }),
        signal: expect.any(AbortSignal),
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

  it('matches the answer by state and ignores a foreign one', async () => {
    const { win, post } = fakeWindow()
    const fetch = registry()
    let settled = false
    const result = start(win, fetch).then((r) => {
      settled = true
      return r
    })
    await flush()
    post(callback({ state: 'someone-elses' }))
    post({ ...callback(), type: 'other' })
    await flush()
    expect(settled).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    post(callback())
    await expect(result).resolves.toEqual({ ok: true })
  })

  it('a failure with the matching state ends the flow', async () => {
    const { win, post } = fakeWindow()
    const fetch = registry()
    const result = start(win, fetch)
    await flush()
    post({ type: 'quilt-mcp-oauth', ok: false, state: STATE, error: 'expired' })
    await expect(result).resolves.toEqual({ ok: false, reason: 'signInFailed' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('still accepts a postMessage answer with the matching state', async () => {
    const { win, legacy } = fakeWindow()
    const result = start(win, registry())
    await flush()
    legacy(callback())
    await expect(result).resolves.toEqual({ ok: true })
  })

  it('refuses an authorize URL without a state to match', async () => {
    const { win } = fakeWindow()
    const fetch = vi.fn(async () =>
      json({ authorizeUrl: 'https://provider.test/authorize' }),
    )
    await expect(start(win, fetch as any)).resolves.toEqual({
      ok: false,
      reason: 'failed',
      error: 'InvalidAuthorizeUrl',
    })
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
    post({ type: 'quilt-mcp-oauth', ok: false, state: STATE, error: 'denied' })
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

  it('a stalled finish request times out and settles', async () => {
    vi.useFakeTimers()
    const { win, post } = fakeWindow()
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) =>
      String(url).endsWith('/start')
        ? json({ authorizeUrl: `https://provider.test/authorize?state=${STATE}` })
        : new Promise<Response>((_resolve, reject) =>
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('The request timed out')),
            ),
          ),
    )
    const result = start(win, fetch as any)
    await vi.advanceTimersByTimeAsync(0)
    post(callback())
    await vi.advanceTimersByTimeAsync(0)
    expect(String(fetch.mock.calls[1]?.[0])).toBe(
      `${REGISTRY}/api/mcp/slack/oauth/finish`,
    )
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(result).resolves.toEqual({ ok: false, reason: 'timedOut' })
  })

  it('an already-aborted signal opens no window and sends nothing', async () => {
    const { win } = fakeWindow()
    const fetch = registry()
    const controller = new AbortController()
    controller.abort()
    await expect(
      signIn({
        slug: 'slack',
        registryUrl: REGISTRY,
        getToken: async () => 't',
        win,
        fetch,
        signal: controller.signal,
      }),
    ).resolves.toEqual({ ok: false, reason: 'closed' })
    expect(win.open).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a bad registry URL fails before any window opens', async () => {
    const { win } = fakeWindow()
    const fetch = registry()
    await expect(
      signIn({
        slug: 'slack',
        registryUrl: 'not a url',
        getToken: async () => 't',
        win,
        fetch,
      }),
    ).resolves.toEqual({ ok: false, reason: 'failed', error: 'InvalidRegistryUrl' })
    expect(win.open).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('names each sign-in window uniquely', async () => {
    const { win } = fakeWindow()
    ;(win.open as any).mockReturnValue(null)
    await start(win, registry())
    await start(win, registry())
    const [a, b] = (win.open as any).mock.calls.map((c: unknown[]) => c[1])
    expect(a).toMatch(/^quilt-mcp-oauth-/)
    expect(a).not.toBe(b)
  })

  it('reports a blocked popup without calling the registry', async () => {
    const { win } = fakeWindow()
    ;(win.open as any).mockReturnValue(null)
    const fetch = registry()
    await expect(start(win, fetch)).resolves.toEqual({ ok: false, reason: 'blocked' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a closed popup does not end the flow; an answer still finishes it', async () => {
    vi.useFakeTimers()
    const { win, popup, post } = fakeWindow()
    const onWaiting = vi.fn()
    let settled = false
    const result = start(win, registry(), { onWaiting }).then((r) => {
      settled = true
      return r
    })
    await vi.advanceTimersByTimeAsync(10)
    popup.closed = true
    await vi.advanceTimersByTimeAsync(5_000)
    expect(settled).toBe(false)
    expect(onWaiting).toHaveBeenCalledTimes(1)
    post(callback())
    await vi.advanceTimersByTimeAsync(10)
    await expect(result).resolves.toEqual({ ok: true })
  })

  it('stops waiting after ten minutes', async () => {
    vi.useFakeTimers()
    const { win, popup, channel } = fakeWindow()
    const result = start(win, registry())
    await vi.advanceTimersByTimeAsync(10)
    popup.closed = true
    await vi.advanceTimersByTimeAsync(10 * 60_000 - 100)
    let settled = false
    void result.then(() => (settled = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    await expect(result).resolves.toEqual({ ok: false, reason: 'waitTimedOut' })
    expect(channel.close).toHaveBeenCalled()
  })

  it.each([
    [404, 'NotFound', 'notFound'],
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
    [429, 'Busy', 'busy'],
    [503, 'NeedsClientCredentials', 'needsClientCredentials'],
    [503, 'SignInServerUnavailable', 'serverTrouble'],
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

  it('a 401 without a code is the catalog session expiring', async () => {
    const { win } = fakeWindow()
    const fetch = vi.fn(async () => new Response('Not logged in', { status: 401 }))
    await expect(start(win, fetch as any)).resolves.toEqual({
      ok: false,
      reason: 'sessionExpired',
    })
  })

  it('a code naming an Object.prototype member is just unknown', async () => {
    const { win } = fakeWindow()
    const fetch = vi.fn(async () => json({ error_code: 'toString' }, 500))
    await expect(start(win, fetch as any)).resolves.toEqual({
      ok: false,
      reason: 'failed',
      error: 'toString',
    })
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
    refetch.current = async () => ({})
    refetch.calls = 0
    retries = 0
    cleanup()
  })

  const reply = (slug = 'slack') =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: callback({ slug }),
        origin: REGISTRY,
        source: popup as unknown as Window,
      }),
    )

  const getToken = () => Eff.Effect.succeed('tok')
  function mount(service: Connectors.ConnectorsService, list = servers) {
    const result = { current: null as unknown as ReturnType<typeof useMcpSignIn> }
    function Probe() {
      result.current = useMcpSignIn(list, service, getToken)
      return null
    }
    const view = render(React.createElement(Probe))
    return Object.assign(result, { unmount: view.unmount })
  }

  it("a second server's sign-in leaves the first one's waiting reconnect alone", async () => {
    window.fetch = registry() as any
    const slack = Eff.Effect.runSync(
      Eff.SubscriptionRef.make<Connectors.ConnectorState>(
        Connectors.ConnectorState.Connecting(),
      ),
    )
    const fathom = Eff.Effect.runSync(
      Eff.SubscriptionRef.make<Connectors.ConnectorState>(failed),
    )
    const retried: string[] = []
    const service = {
      byId: {
        slack: { state: slack, retry: Eff.Effect.sync(() => void retried.push('slack')) },
        fathom: {
          state: fathom,
          retry: Eff.Effect.sync(() => void retried.push('fathom')),
        },
      },
    } as any
    const result = mount(service, [
      ...servers,
      { ...servers[0], slug: 'fathom', title: 'Fathom' },
    ])
    for (const slug of ['slack', 'fathom']) {
      await act(async () => {
        result.current.connect(slug)
        await flush()
        reply(slug)
        await flush()
        await flush()
      })
    }
    expect(retried).toEqual(['fathom'])
    await act(async () => {
      Eff.Effect.runSync(Eff.SubscriptionRef.set(slack, failed))
      await flush()
    })
    expect(retried).toEqual(['fathom', 'slack'])
  })

  it('holds the reconnect while the connector is still reconnecting', async () => {
    window.fetch = registry() as any
    const { state, service } = makeConnectors(
      Connectors.ConnectorState.Disconnected({
        retrying: true,
        error: { _tag: 'Transport', message: 'down' },
      }),
    )
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await flush()
      reply()
      await flush()
      await flush()
    })
    expect(retries).toBe(0)
    await act(async () => {
      Eff.Effect.runSync(
        Eff.SubscriptionRef.set(state, Connectors.ConnectorState.Connecting()),
      )
      await flush()
    })
    expect(retries).toBe(0)
    await act(async () => {
      Eff.Effect.runSync(Eff.SubscriptionRef.set(state, failed))
      await flush()
    })
    expect(retries).toBe(1)
  })

  it('a Connect for a server not in the list (an admin, disabled server) still reaches Ready', async () => {
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
    const result = mount(service, [])
    let outcome: unknown
    await act(async () => {
      const done = result.current.connect('slack', { title: 'Slack' })
      await flush()
      signedIn = true
      reply()
      outcome = await done
      await settled('Ready')
    })
    expect(outcome).toEqual({ ok: true, message: 'Connected Slack.' })
    await Eff.Effect.runPromise(Eff.Scope.close(scope, Eff.Exit.void))
  })

  it('retries even when the wait for a settled connector runs out', async () => {
    vi.useFakeTimers()
    window.fetch = registry() as any
    const { service } = makeConnectors(Connectors.ConnectorState.Connecting())
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await vi.advanceTimersByTimeAsync(10)
      reply()
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(retries).toBe(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(91_000)
    })
    vi.useRealTimers()
    expect(retries).toBe(1)
  })

  it('refetches the server list only after a successful sign-in', async () => {
    window.fetch = registry(() => json({ error_code: 'SignInFailed' }, 400)) as any
    const { service } = makeConnectors(failed)
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await flush()
      reply()
      await flush()
      await flush()
    })
    expect(refetch.calls).toBe(0)
    window.fetch = registry() as any
    await act(async () => {
      result.current.connect('slack')
      await flush()
      reply()
      await flush()
      await flush()
    })
    expect(refetch.calls).toBe(1)
  })

  it('shows a friendly message, never the raw error, when a request fails', async () => {
    window.fetch = vi.fn(async () => json({ error_code: 'Weird' }, 500)) as any
    const { service } = makeConnectors(failed)
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await flush()
      await flush()
    })
    expect(result.current.status).toBe("Couldn't connect Slack, try again.")
    expect(result.current.status).not.toContain('Weird')
  })

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

  it('a failing refetch still frees Connect and reconnects', async () => {
    window.fetch = registry() as any
    refetch.current = () => Promise.reject(new Error('network'))
    const { service } = makeConnectors(failed)
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await flush()
      reply()
      await flush()
      await flush()
    })
    expect(result.current.pending).toBeNull()
    expect(retries).toBe(1)
  })

  it('unmounting drops a reconnect still waiting on a connection attempt', async () => {
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
    result.unmount()
    await flush()
    Eff.Effect.runSync(Eff.SubscriptionRef.set(state, failed))
    await flush()
    expect(retries).toBe(0)
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

  it('a popup closed with no answer says to finish there, and Connect can start over', async () => {
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
    expect(result.current.status).toBe('Finish signing in to Slack in the other window.')
    expect(retries).toBe(0)
    const opened = (window.open as any).mock.calls.length
    await act(async () => {
      result.current.connect('slack')
      await flush()
    })
    expect(result.current.pending).toBe('slack')
    expect((window.open as any).mock.calls.length).toBe(opened + 1)
  })

  it.each([
    [
      503,
      'NeedsClientCredentials',
      "Couldn't connect Slack: an admin must add this service's client credentials.",
    ],
    [429, 'Busy', "Couldn't connect Slack right now. Try again in a moment."],
    [503, 'NotAvailable', "Couldn't connect Slack: sign-in isn't available right now."],
    [404, 'NotFound', "Slack isn't available to sign in to on this stack."],
    [503, 'SignInServerUnavailable', 'Slack is having trouble, try again shortly.'],
  ])('start %i %s tells the user what to do', async (status, code, message) => {
    window.fetch = vi.fn(async () => json({ error_code: code }, status)) as any
    const { service } = makeConnectors(failed)
    const result = mount(service)
    await act(async () => {
      result.current.connect('slack')
      await flush()
      await flush()
    })
    expect(result.current.status).toBe(message)
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
