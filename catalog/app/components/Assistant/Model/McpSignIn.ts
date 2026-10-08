import * as Eff from 'effect'
import * as React from 'react'
import * as urql from 'urql'
import * as uuid from 'uuid'

import cfg from 'constants/config'
import { runtime } from 'utils/Effect'
import * as GQL from 'utils/GraphQL'
import { McpServerAuth } from 'model/graphql/types.generated'

import type * as Connectors from './Connectors'
import MCP_SERVER_DISCONNECT_MUTATION from './gql/McpServerDisconnect.generated'
import MCP_SERVERS_QUERY from './gql/McpServers.generated'

export type SignInFailure =
  | 'blocked'
  | 'closed'
  | 'denied'
  | 'signInFailed'
  | 'needsClientCredentials'
  | 'busy'
  | 'notAvailable'
  | 'notFound'
  | 'sessionExpired'
  | 'serverTrouble'
  | 'timedOut'
  | 'waitTimedOut'
  | 'unsupported'
  | 'failed'

/** The registry's start and finish error codes, by the reason they map to. */
const REASON_BY_CODE: Record<string, SignInFailure> = {
  SignInFailed: 'signInFailed',
  NeedsSignIn: 'signInFailed',
  NeedsClientCredentials: 'needsClientCredentials',
  Busy: 'busy',
  NotAvailable: 'notAvailable',
  NotFound: 'notFound',
  SignInServerUnavailable: 'serverTrouble',
}

/** `error` is for debugging and is never shown to the user. */
export type SignInResult =
  | { ok: true }
  | { ok: false; reason: SignInFailure; error?: string }

interface Channel {
  onmessage: ((event: MessageEvent) => void) | null
  close: () => void
}

export const CALLBACK_CHANNEL = 'quilt-mcp-oauth'

export interface SignInOptions {
  slug: string
  registryUrl: string
  /** The catalog session token; start and finish both need a signed-in user. */
  getToken: () => Promise<string | null>
  win?: Window
  fetch?: typeof fetch
  /** Where the catalog's callback page posts the provider's answer. */
  openChannel?: () => Channel | null
  /** Aborting closes the popup and drops the flow, finish request included. */
  signal?: AbortSignal
  /** Called once when the popup reads as closed while the sign-in may still finish. */
  onWaiting?: () => void
  /** Called once when the provider's answer arrives, before finish is sent. */
  onAnswered?: () => void
}

const POPUP_FEATURES = 'popup,width=520,height=700'
const CLOSED_POLL_MS = 500
const REQUEST_TIMEOUT_MS = 30_000
/** How long a sign-in may run, including in a window the catalog can no longer see. */
const SIGN_IN_TIMEOUT_MS = 10 * 60_000
/** Longer than a connector bootstrap, so an attempt in flight settles first. */
const RETRY_WAIT = Eff.Duration.seconds(90)

// A plain sentinel: an `Error` subclass loses `instanceof` in the ES5 build.
const TIMED_OUT = { timedOut: true } as const

const defaultChannel = (): Channel | null =>
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CALLBACK_CHANNEL)

/** The message of a mutation's `InvalidInput` or `OperationError` result. */
export const resultError = (
  result:
    | { __typename: 'InvalidInput'; errors: readonly { message: string }[] }
    | { __typename: 'OperationError'; message: string },
) =>
  result.__typename === 'InvalidInput'
    ? result.errors.map((e) => e.message).join('; ')
    : result.message

interface CallbackMessage {
  type?: unknown
  slug?: unknown
  ok?: unknown
  code?: unknown
  state?: unknown
  iss?: unknown
  error?: unknown
}

/**
 * Sign the user in to an MCP server in a popup. The popup is opened before the
 * start request so the click's user activation is still live: browsers block a
 * `window.open` that follows an await.
 *
 * The provider's answer comes back through the catalog's callback page, matched
 * by the `state` in the authorize URL; a provider page with
 * `Cross-Origin-Opener-Policy` severs the popup, so neither `opener` nor
 * `popup.closed` can be relied on. The exchange happens here, under the catalog
 * session, so a code cannot be bound to whoever started the flow. The code and
 * state are never logged or reported.
 *
 * The channel exposes the code to any same-origin listener. Only this tab holds
 * the matching `state` and the session to finish with, but this design does not
 * defend against compromised script running on the catalog's origin.
 */
export function signIn({
  slug,
  registryUrl,
  getToken,
  win = window,
  fetch: doFetch = win.fetch.bind(win),
  openChannel = defaultChannel,
  signal,
  onWaiting,
  onAnswered,
}: SignInOptions): Promise<SignInResult> {
  try {
    new URL(registryUrl)
  } catch {
    return Promise.resolve({ ok: false, reason: 'failed', error: 'InvalidRegistryUrl' })
  }
  if (signal?.aborted) return Promise.resolve({ ok: false, reason: 'closed' })
  // Opened before the popup: without it the answer can never arrive, so the
  // user should not be sent to the provider at all.
  let channel: Channel | null
  try {
    channel = openChannel()
  } catch {
    channel = null
  }
  if (!channel) return Promise.resolve({ ok: false, reason: 'unsupported' })
  // Unique per flow, so two tabs never share one sign-in window.
  const popup = win.open('', `quilt-mcp-oauth-${uuid.v4()}`, POPUP_FEATURES)
  if (!popup) {
    channel.close()
    return Promise.resolve({ ok: false, reason: 'blocked' })
  }
  // Severed while the popup is still same-origin: the provider's page must not
  // be able to navigate this tab. The answer comes back on the channel instead.
  try {
    popup.opener = null
  } catch {
    // A browser that refuses still isolates the popup once it navigates cross-origin.
  }
  const base = `${registryUrl}/api/mcp/${encodeURIComponent(slug)}/oauth`

  const post = async (path: string, body?: object) => {
    // Once the callback has arrived nothing else ends the flow, so a stalled
    // request must time out.
    const timeout = new AbortController()
    const onOuterAbort = () => timeout.abort()
    signal?.addEventListener('abort', onOuterAbort)
    const timer = win.setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS)
    try {
      if (signal?.aborted) throw new Error('aborted')
      const token = await getToken()
      const resp = await doFetch(`${base}/${path}`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: timeout.signal,
      })
      const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null
      const errorCode = typeof json?.error_code === 'string' ? json.error_code : undefined
      return { resp, json, errorCode }
    } catch (e) {
      // Whatever a fetch rejects with on abort, our own signal says why it ended.
      if (timeout.signal.aborted) throw TIMED_OUT
      throw e
    } finally {
      win.clearTimeout(timer)
      signal?.removeEventListener('abort', onOuterAbort)
    }
  }

  return new Promise<SignInResult>((resolve) => {
    let done = false
    let answered = false
    let waiting = false
    let expectedState: string | null = null
    const settle = (result: SignInResult) => {
      if (done) return
      done = true
      channel.onmessage = null
      channel.close()
      win.clearInterval(poll)
      win.clearTimeout(cap)
      signal?.removeEventListener('abort', onAbort)
      if (!popup.closed) popup.close()
      resolve(result)
    }
    const onAbort = () => settle({ ok: false, reason: 'closed' })
    const refused = (resp: Response, errorCode?: string): SignInResult => {
      const known =
        errorCode && Object.prototype.hasOwnProperty.call(REASON_BY_CODE, errorCode)
      // Only the catalog's own login check answers 401 without a code.
      const reason: SignInFailure = known
        ? REASON_BY_CODE[errorCode]
        : resp.status === 401 && !errorCode
          ? 'sessionExpired'
          : 'failed'
      return reason === 'failed'
        ? { ok: false, reason, error: errorCode ?? `HTTP ${resp.status}` }
        : { ok: false, reason }
    }
    const failed = (e: unknown): SignInResult =>
      e === TIMED_OUT
        ? { ok: false, reason: 'timedOut' }
        : { ok: false, reason: 'failed', error: 'request failed' }

    const onAnswer = (data: CallbackMessage) => {
      if (answered || done || expectedState === null) return
      if (data.type !== 'quilt-mcp-oauth' || data.state !== expectedState) return
      answered = true
      win.clearInterval(poll)
      onAnswered?.()
      if (data.ok !== true || typeof data.code !== 'string') {
        settle({ ok: false, reason: data.error === 'denied' ? 'denied' : 'signInFailed' })
        return
      }
      const body = {
        code: data.code,
        state: expectedState,
        ...(typeof data.iss === 'string' ? { iss: data.iss } : {}),
      }
      post('finish', body)
        .then(({ resp, json, errorCode }) => {
          if (resp.ok && json?.ok === true) settle({ ok: true })
          else settle(refused(resp, errorCode))
        })
        .catch((e) => settle(failed(e)))
    }
    // The only answer path: a window message carries no proof of who sent it.
    channel.onmessage = (event) => onAnswer(event.data ?? {})
    signal?.addEventListener('abort', onAbort)
    const poll = win.setInterval(() => {
      if (!waiting && popup.closed) {
        waiting = true
        onWaiting?.()
      }
    }, CLOSED_POLL_MS)
    const cap = win.setTimeout(
      () => settle({ ok: false, reason: 'waitTimedOut' }),
      SIGN_IN_TIMEOUT_MS,
    )

    if (signal?.aborted) {
      onAbort()
      return
    }
    post('start')
      .then(({ resp, json, errorCode }) => {
        if (!resp.ok || typeof json?.authorizeUrl !== 'string') {
          settle(refused(resp, errorCode))
          return
        }
        // The blank popup shares this origin, so a `javascript:` URL from a
        // hostile server's metadata would run as the catalog.
        let url: URL | null = null
        try {
          url = new URL(json.authorizeUrl)
        } catch {
          url = null
        }
        const state = url?.searchParams.get('state')
        if (!url || url.protocol !== 'https:' || !state) {
          settle({ ok: false, reason: 'failed', error: 'InvalidAuthorizeUrl' })
          return
        }
        expectedState = state
        if (!done) popup.location.href = url.href
      })
      .catch((e) => settle(failed(e)))
  })
}

type Servers = GQL.DataForDoc<typeof MCP_SERVERS_QUERY>['mcpServers']

export interface SignInServer {
  slug: string
  title: string
  signedIn: boolean
}

export interface SignInActionOptions {
  /** Where focus returns; defaults to the element focused when the action began. */
  returnTo?: HTMLElement | null
  /** Used instead when `returnTo` is gone, or the action succeeded and will replace it. */
  stable?: HTMLElement | null
  /** For a server missing from the user's list, such as a disabled one an admin connects. */
  title?: string
  /** The caller announces the outcome itself, so the shared status stays empty. */
  quiet?: boolean
  /** Told when Quilt loses sight of the sign-in window and keeps waiting. */
  onWaiting?: (message: string) => void
}

/** `null` when another action was already running, or the flow was dropped. */
type ActionOutcome = { ok: boolean; message: string } | null
type ActionResult = Promise<ActionOutcome>

export interface McpSignInAPI {
  /** The servers each user signs in to themselves. */
  servers: readonly SignInServer[]
  pending: string | null
  /** The last outcome, for a live region. */
  status: string
  connect: (slug: string, opts?: SignInActionOptions) => ActionResult
  disconnect: (slug: string, opts?: SignInActionOptions) => ActionResult
}

/** The one sign-in flow per page, so every Connect reconnects Qurator's connector. */
export const McpSignInContext = React.createContext<McpSignInAPI | null>(null)

const FAILURE: Record<SignInFailure, (title: string) => string> = {
  blocked: (t) =>
    `The browser blocked the ${t} sign-in window. Allow pop-ups for this site and try again.`,
  closed: (t) => `The ${t} sign-in window was closed before you finished.`,
  denied: (t) => `${t} sign-in was declined.`,
  signInFailed: (t) => `${t} sign-in failed, try again.`,
  needsClientCredentials: (t) =>
    `Couldn't connect ${t}: an admin must add this service's client credentials.`,
  busy: (t) => `Couldn't connect ${t} right now. Try again in a moment.`,
  notAvailable: (t) => `Couldn't connect ${t}: sign-in isn't available right now.`,
  notFound: (t) => `${t} isn't available to sign in to on this stack.`,
  sessionExpired: (t) =>
    `Couldn't connect ${t}: your Quilt session expired. Sign in again.`,
  serverTrouble: (t) => `${t} is having trouble, try again shortly.`,
  timedOut: (t) => `Connecting ${t} timed out, try again.`,
  waitTimedOut: (t) =>
    `${t} sign-in took too long, so Quilt stopped waiting. Connect again.`,
  unsupported: () => "This browser can't finish sign-in here; try another browser.",
  failed: (t) => `Couldn't connect ${t}, try again.`,
}

/** What to tell the user about a finished `signIn`; never the raw error. */
export const signInMessage = (result: SignInResult, title: string) =>
  result.ok ? `Connected ${title}.` : FAILURE[result.reason](title)

/**
 * Connect and disconnect the signed-in user's own account on each OAUTH server.
 * The connector set is built once per mount, so a change reaches the assistant
 * by retrying that server's connector rather than by rebuilding the set.
 */
export function useMcpSignIn(
  servers: Servers,
  connectors: Connectors.ConnectorsService | null,
  getToken: () => Eff.Effect.Effect<string | null>,
): McpSignInAPI {
  const client = urql.useClient()
  const disconnectMutation = GQL.useMutation(MCP_SERVER_DISCONNECT_MUTATION)
  const [pending, setPending] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState('')
  const flow = React.useRef<AbortController | null>(null)
  const busy = React.useRef(false)
  // Set while a sign-in waits on a window Quilt can no longer see, which the
  // user may already have closed: any action replaces it. Cleared once the
  // provider answers, so a finish in flight is never cancelled.
  const waiting = React.useRef(false)
  // Per server, so one server's reconnect never cancels another's.
  const retryFibers = React.useRef(
    new Map<string, Eff.Fiber.RuntimeFiber<unknown, unknown>>(),
  )
  React.useEffect(
    () => () => {
      flow.current?.abort()
      retryFibers.current.forEach((f) => runtime.runFork(Eff.Fiber.interrupt(f)))
    },
    [],
  )

  const oauth = React.useMemo(
    () =>
      servers
        .filter((s) => s.auth === McpServerAuth.OAUTH)
        .map((s) => ({ slug: s.slug, title: s.title, signedIn: s.signedIn })),
    [servers],
  )

  const run = React.useCallback(
    async (
      slug: string,
      focus: SignInActionOptions,
      act: (
        title: string,
        signal: AbortSignal,
        say: (message: string) => void,
      ) => Promise<{ ok: boolean; message: string }>,
    ): Promise<ActionOutcome> => {
      if (busy.current && !waiting.current) return null
      if (waiting.current) flow.current?.abort()
      busy.current = true
      waiting.current = false
      const controller = new AbortController()
      const title = focus.title ?? oauth.find((s) => s.slug === slug)?.title ?? slug
      const active = document.activeElement as HTMLElement | null
      // Safari leaves `body` focused after a click on a button.
      const returnTo =
        focus.returnTo ?? (active && active !== document.body ? active : null)
      const say = (message: string) => {
        if (!focus.quiet && !controller.signal.aborted) setStatus(message)
      }
      flow.current = controller
      setPending(slug)
      setStatus('')
      let ok = false
      try {
        const result = await act(title, controller.signal, say)
        ok = result.ok
        if (controller.signal.aborted) return null
        say(result.message)
        return result
      } finally {
        if (!controller.signal.aborted) {
          flow.current = null
          busy.current = false
          waiting.current = false
          setPending(null)
          if (ok) {
            client
              .query(MCP_SERVERS_QUERY, {}, { requestPolicy: 'network-only' })
              .toPromise()
              .catch(() => undefined)
          }
          const connector = connectors?.byId[slug]
          // A retry is lost while an attempt is in flight (Connecting, or the
          // reconnect loop under Disconnected), so wait for one to settle.
          if (connector && ok) {
            const previous = retryFibers.current.get(slug)
            if (previous) runtime.runFork(Eff.Fiber.interrupt(previous))
            retryFibers.current.set(
              slug,
              runtime.runFork(
                connector.state.changes.pipe(
                  Eff.Stream.filter((s) => s._tag === 'Ready' || s._tag === 'Failed'),
                  Eff.Stream.take(1),
                  Eff.Stream.runDrain,
                  Eff.Effect.timeout(RETRY_WAIT),
                  // Retry even when the wait ran out: the sign-in did succeed.
                  Eff.Effect.ignore,
                  Eff.Effect.zipRight(connector.retry),
                ),
              ),
            )
          }
          const target =
            (ok || !returnTo?.isConnected) && focus.stable ? focus.stable : returnTo
          if (target?.isConnected) target.focus()
        }
      }
    },
    [oauth, client, connectors],
  )

  const connect = React.useCallback(
    (slug: string, opts: SignInActionOptions = {}) =>
      run(slug, opts, async (title, signal, say) => {
        const result = await signIn({
          slug,
          registryUrl: cfg.registryUrl,
          getToken: () => Eff.Effect.runPromise(getToken()),
          signal,
          onWaiting: () => {
            if (signal.aborted) return
            waiting.current = true
            setPending(null)
            const message = `Finish signing in to ${title} in the other window.`
            say(message)
            opts.onWaiting?.(message)
          },
          onAnswered: () => {
            // Finishing now: nothing in the UI may cancel it from here.
            if (signal.aborted) return
            waiting.current = false
            setPending(slug)
            say('')
          },
        })
        return { ok: result.ok, message: signInMessage(result, title) }
      }),
    [run, getToken],
  )

  const disconnect = React.useCallback(
    (slug: string, opts: SignInActionOptions = {}) =>
      run(slug, opts, async (title) => {
        try {
          const result = (await disconnectMutation({ slug })).mcpServerDisconnect
          if (result.__typename === 'Ok') {
            return { ok: true, message: `Disconnected ${title}.` }
          }
          return {
            ok: false,
            message: `Couldn't disconnect ${title}: ${resultError(result)}`,
          }
        } catch {
          return { ok: false, message: `Couldn't disconnect ${title}, try again.` }
        }
      }),
    [run, disconnectMutation],
  )

  return React.useMemo(
    () => ({ servers: oauth, pending, status, connect, disconnect }),
    [oauth, pending, status, connect, disconnect],
  )
}
