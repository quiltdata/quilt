import * as Eff from 'effect'
import * as React from 'react'
import * as urql from 'urql'

import cfg from 'constants/config'
import { runtime } from 'utils/Effect'
import * as GQL from 'utils/GraphQL'
import { McpServerAuth } from 'model/graphql/types.generated'

import type * as Connectors from './Connectors'
import MCP_SERVER_DISCONNECT_MUTATION from './gql/McpServerDisconnect.generated'
import MCP_SERVERS_QUERY from './gql/McpServers.generated'

export type SignInFailure = 'blocked' | 'closed' | 'denied' | 'signInFailed' | 'failed'

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
}

const POPUP_FEATURES = 'popup,width=520,height=700'
const CLOSED_POLL_MS = 500

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
}: SignInOptions): Promise<SignInResult> {
  const popup = win.open('', 'quilt-mcp-oauth', POPUP_FEATURES)
  if (!popup) return Promise.resolve({ ok: false, reason: 'blocked' })
  const registryOrigin = new URL(registryUrl).origin
  const base = `${registryUrl}/api/mcp/${encodeURIComponent(slug)}/oauth`

  const post = async (path: string, body?: object) => {
    const token = await getToken()
    const resp = await doFetch(`${base}/${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null
    const errorCode = typeof json?.error_code === 'string' ? json.error_code : undefined
    return { resp, json, errorCode }
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
      if (!popup.closed) popup.close()
      resolve(result)
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
          else if (errorCode === 'SignInFailed')
            settle({ ok: false, reason: 'signInFailed' })
          else
            settle({
              ok: false,
              reason: 'failed',
              error: errorCode ?? `HTTP ${resp.status}`,
            })
        })
        .catch((e) => settle(failed(e)))
    }
    win.addEventListener('message', onMessage)
    const poll = win.setInterval(() => {
      if (popup.closed) settle({ ok: false, reason: 'closed' })
    }, CLOSED_POLL_MS)

    post('start')
      .then(({ resp, json, errorCode }) => {
        if (!resp.ok || typeof json?.authorizeUrl !== 'string') {
          settle({
            ok: false,
            reason: 'failed',
            error: errorCode ?? `HTTP ${resp.status}`,
          })
          return
        }
        if (!done) popup.location.href = json.authorizeUrl
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
  connect: (slug: string, returnFocus?: HTMLElement | null) => void
  disconnect: (slug: string, returnFocus?: HTMLElement | null) => void
}

const FAILURE: Record<SignInFailure, (title: string) => string> = {
  blocked: (t) =>
    `The browser blocked the ${t} sign-in window. Allow pop-ups for this site and try again.`,
  closed: (t) => `The ${t} sign-in window was closed before you finished.`,
  denied: (t) => `${t} sign-in was declined.`,
  signInFailed: (t) => `${t} sign-in failed, try again.`,
  failed: (t) => `Couldn't connect ${t}.`,
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
      returnFocus: HTMLElement | null | undefined,
      act: (title: string) => Promise<string>,
    ) => {
      if (pending) return
      const title = oauth.find((s) => s.slug === slug)?.title ?? slug
      const focusTarget = returnFocus ?? (document.activeElement as HTMLElement | null)
      setPending(slug)
      setStatus('')
      try {
        setStatus(await act(title))
      } finally {
        setPending(null)
        await client
          .query(MCP_SERVERS_QUERY, {}, { requestPolicy: 'network-only' })
          .toPromise()
        const connector = connectors.byId[slug]
        if (connector) runtime.runFork(connector.retry)
        if (focusTarget?.isConnected) focusTarget.focus()
      }
    },
    [pending, oauth, client, connectors],
  )

  const connect = React.useCallback(
    (slug: string, returnFocus?: HTMLElement | null) =>
      void run(slug, returnFocus, async (title) => {
        const result = await signIn({
          slug,
          registryUrl: cfg.registryUrl,
          getToken: () => Eff.Effect.runPromise(getToken()),
        })
        if (result.ok) return `Connected ${title}.`
        const message = FAILURE[result.reason](title)
        return result.error ? `${message} (${result.error})` : message
      }),
    [run, getToken],
  )

  const disconnect = React.useCallback(
    (slug: string, returnFocus?: HTMLElement | null) =>
      void run(slug, returnFocus, async (title) => {
        try {
          const result = (await disconnectMutation({ slug })).mcpServerDisconnect
          if (result.__typename === 'Ok') return `Disconnected ${title}.`
          return result.__typename === 'InvalidInput'
            ? `Couldn't disconnect ${title}: ${result.errors.map((e) => e.message).join('; ')}`
            : `Couldn't disconnect ${title}: ${result.message}`
        } catch (e) {
          return `Couldn't disconnect ${title}: ${e instanceof Error ? e.message : e}`
        }
      }),
    [run, disconnectMutation],
  )

  return React.useMemo(
    () => ({ servers: oauth, pending, status, connect, disconnect }),
    [oauth, pending, status, connect, disconnect],
  )
}
