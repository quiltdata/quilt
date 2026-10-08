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

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: SignInFailure; error?: string }

export interface SignInOptions {
  slug: string
  registryUrl: string
  /** The catalog session token; start and finish both need a signed-in user. */
  getToken: () => Promise<string | null>
  win?: Window
  fetch?: typeof fetch
  /** Aborting closes the popup and drops the flow, finish request included. */
  signal?: AbortSignal
}

const POPUP_FEATURES = 'popup,width=520,height=700'
const CLOSED_POLL_MS = 500
const REQUEST_TIMEOUT_MS = 30_000
/** Longer than a connector bootstrap, so an attempt in flight settles first. */
const RETRY_WAIT = Eff.Duration.seconds(90)

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
 * The callback page only hands the code back; the exchange happens here, under
 * the catalog session, so a code cannot be bound to whoever started the flow.
 * The code and state are never logged or reported.
 */
export function signIn({
  slug,
  registryUrl,
  getToken,
  win = window,
  fetch: doFetch = win.fetch.bind(win),
  signal,
}: SignInOptions): Promise<SignInResult> {
  let registryOrigin: string
  try {
    registryOrigin = new URL(registryUrl).origin
  } catch {
    return Promise.resolve({ ok: false, reason: 'failed', error: 'InvalidRegistryUrl' })
  }
  // Unique per flow, so two tabs never share one sign-in window.
  const popup = win.open('', `quilt-mcp-oauth-${uuid.v4()}`, POPUP_FEATURES)
  if (!popup) return Promise.resolve({ ok: false, reason: 'blocked' })
  const base = `${registryUrl}/api/mcp/${encodeURIComponent(slug)}/oauth`

  const post = async (path: string, body?: object) => {
    // Once the callback has arrived nothing else ends the flow, so a stalled
    // request must time out.
    const timeout = new AbortController()
    const onOuterAbort = () => timeout.abort()
    signal?.addEventListener('abort', onOuterAbort)
    const timer = win.setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS)
    try {
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
    } finally {
      win.clearTimeout(timer)
      signal?.removeEventListener('abort', onOuterAbort)
    }
  }

  return new Promise<SignInResult>((resolve) => {
    let done = false
    // Set by the first valid callback message: later ones, and the popup
    // closing itself, are then ignored.
    let answered = false
    const settle = (result: SignInResult) => {
      if (done) return
      done = true
      win.removeEventListener('message', onMessage)
      win.clearInterval(poll)
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
    const failed = (e: unknown): SignInResult => ({
      ok: false,
      reason: 'failed',
      error: e instanceof Error ? e.message : 'request failed',
    })

    const onMessage = (event: MessageEvent) => {
      // Only the registry's callback page, in the popup we opened, may answer.
      if (answered || event.origin !== registryOrigin || event.source !== popup) return
      const data = (event.data ?? {}) as CallbackMessage
      if (data.type !== 'quilt-mcp-oauth' || data.slug !== slug) return
      answered = true
      win.clearInterval(poll)
      if (
        data.ok !== true ||
        typeof data.code !== 'string' ||
        typeof data.state !== 'string'
      ) {
        settle({
          ok: false,
          reason: data.error === 'denied' ? 'denied' : 'signInFailed',
        })
        return
      }
      const body = {
        code: data.code,
        state: data.state,
        ...(typeof data.iss === 'string' ? { iss: data.iss } : {}),
      }
      post('finish', body)
        .then(({ resp, json, errorCode }) => {
          if (resp.ok && json?.ok === true) settle({ ok: true })
          else settle(refused(resp, errorCode))
        })
        .catch((e) => settle(failed(e)))
    }
    win.addEventListener('message', onMessage)
    signal?.addEventListener('abort', onAbort)
    const poll = win.setInterval(() => {
      if (popup.closed) settle({ ok: false, reason: 'closed' })
    }, CLOSED_POLL_MS)

    if (signal?.aborted) onAbort()
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
        if (!url || url.protocol !== 'https:') {
          settle({ ok: false, reason: 'failed', error: 'InvalidAuthorizeUrl' })
          return
        }
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

export interface McpSignInAPI {
  /** The servers each user signs in to themselves. */
  servers: readonly SignInServer[]
  pending: string | null
  /** The last outcome, for a live region. */
  status: string
  /**
   * Focus returns to `returnFocus` (default: the focused element), or to
   * `stableFocus` when that is gone or the connection succeeded and will
   * replace the control that started it.
   */
  connect: (
    slug: string,
    returnFocus?: HTMLElement | null,
    stableFocus?: HTMLElement | null,
  ) => void
  disconnect: (slug: string, returnFocus?: HTMLElement | null) => void
}

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
  failed: (t) => `Couldn't connect ${t}.`,
}

/** What to tell the user about a finished `signIn`. */
export const signInMessage = (result: SignInResult, title: string) => {
  if (result.ok) return `Connected ${title}.`
  const message = FAILURE[result.reason](title)
  return result.error ? `${message} (${result.error})` : message
}

/**
 * Connect and disconnect the signed-in user's own account on each OAUTH server.
 * The connector set is built once per mount, so a change reaches the assistant
 * by retrying that server's connector rather than by rebuilding the set.
 */
export function useMcpSignIn(
  servers: Servers,
  connectors: Connectors.ConnectorsService,
  getToken: () => Eff.Effect.Effect<string | null>,
): McpSignInAPI {
  const client = urql.useClient()
  const disconnectMutation = GQL.useMutation(MCP_SERVER_DISCONNECT_MUTATION)
  const [pending, setPending] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState('')
  const flow = React.useRef<AbortController | null>(null)
  const busy = React.useRef(false)
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
      focus: { returnTo?: HTMLElement | null; stable?: HTMLElement | null },
      act: (
        title: string,
        signal: AbortSignal,
      ) => Promise<{ ok: boolean; message: string }>,
    ) => {
      if (busy.current) return
      busy.current = true
      const title = oauth.find((s) => s.slug === slug)?.title ?? slug
      const returnTo = focus.returnTo ?? (document.activeElement as HTMLElement | null)
      const controller = new AbortController()
      flow.current = controller
      setPending(slug)
      setStatus('')
      let ok = false
      try {
        const result = await act(title, controller.signal)
        ok = result.ok
        if (controller.signal.aborted) return
        setStatus(result.message)
      } finally {
        if (!controller.signal.aborted) {
          flow.current = null
          busy.current = false
          setPending(null)
          client
            .query(MCP_SERVERS_QUERY, {}, { requestPolicy: 'network-only' })
            .toPromise()
            .catch(() => undefined)
          const connector = connectors.byId[slug]
          // A retry during Connecting is a no-op, and that attempt may still end
          // in NeedsSignIn, so wait for it to settle first.
          if (connector && ok) {
            const previous = retryFibers.current.get(slug)
            if (previous) runtime.runFork(Eff.Fiber.interrupt(previous))
            retryFibers.current.set(
              slug,
              runtime.runFork(
                connector.state.changes.pipe(
                  Eff.Stream.filter((s) => s._tag !== 'Connecting'),
                  Eff.Stream.take(1),
                  Eff.Stream.runDrain,
                  Eff.Effect.timeout(RETRY_WAIT),
                  Eff.Effect.zipRight(connector.retry),
                  Eff.Effect.ignore,
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
    (slug: string, returnTo?: HTMLElement | null, stable?: HTMLElement | null) =>
      void run(slug, { returnTo, stable }, async (title, signal) => {
        const result = await signIn({
          slug,
          registryUrl: cfg.registryUrl,
          getToken: () => Eff.Effect.runPromise(getToken()),
          signal,
        })
        return { ok: result.ok, message: signInMessage(result, title) }
      }),
    [run, getToken],
  )

  const disconnect = React.useCallback(
    (slug: string, returnTo?: HTMLElement | null) =>
      void run(slug, { returnTo }, async (title) => {
        try {
          const result = (await disconnectMutation({ slug })).mcpServerDisconnect
          if (result.__typename === 'Ok') {
            return { ok: true, message: `Disconnected ${title}.` }
          }
          return {
            ok: false,
            message: `Couldn't disconnect ${title}: ${resultError(result)}`,
          }
        } catch (e) {
          const why = e instanceof Error ? e.message : String(e)
          return { ok: false, message: `Couldn't disconnect ${title}: ${why}` }
        }
      }),
    [run, disconnectMutation],
  )

  return React.useMemo(
    () => ({ servers: oauth, pending, status, connect, disconnect }),
    [oauth, pending, status, connect, disconnect],
  )
}
