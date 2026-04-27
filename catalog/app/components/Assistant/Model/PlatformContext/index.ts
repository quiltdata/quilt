/**
 * PlatformContext — bridge from the Quilt platform to Qurator.
 *
 * Runs once per Assistant session:
 *   1. `initialize` + `tools/list` against the Platform MCP Server.
 *   2. For each platform tool, create a Qurator `Tool.Descriptor` prefixed
 *      with `mcp__platform__`. Executor proxies to `tools/call`.
 *   3. Read the `quilt-platform://search_syntax` resource as an XML-tagged
 *      context message so the LLM can construct better search queries.
 *   4. Push the resulting `{ tools, messages }` into the shared Assistant
 *      context.
 *
 * The MCP server runs stateless HTTP, so there's no persistent connection to
 * manage. Every tool call is an independent POST with the current session
 * token. Bootstrap runs as an Effect on the shared runtime; fiber
 * interruption aborts in-flight fetches when the Assistant unmounts.
 *
 * URL defaults to `${registryUrl}/mcp/platform/mcp`. Override for local dev
 * via `localStorage.setItem('QUILT_MCP_URL', '…')` (same pattern as
 * `QUILT_BEDROCK_MODEL_ID`).
 */

import * as Eff from 'effect'
import * as React from 'react'
import * as redux from 'react-redux'
import { createSelector } from 'reselect'

import cfg from 'constants/config'
import * as authSelectors from 'containers/Auth/selectors'
import { runtime } from 'utils/Effect'
import * as Log from 'utils/Logging'

import * as Context from '../Context'

import * as Mcp from './Mcp'

const MODULE = 'PlatformContext'
const LOGGER = Log.default.getLogger(MODULE)

const MCP_URL_KEY = 'QUILT_MCP_URL'

function getMcpUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const override = localStorage.getItem(MCP_URL_KEY)
    if (override) return override
  }
  return `${cfg.registryUrl}/mcp/platform/mcp`
}

/**
 * Memoized projection from auth state to the bare bearer token. Mirrors the
 * pattern in `utils/PFSCookieManager.tsx` — composed from
 * `authSelectors.tokens` rather than indexing the redux state directly.
 */
const selectToken = createSelector(
  authSelectors.tokens,
  (tokens) => (tokens as { token?: string } | undefined)?.token,
)

const EMPTY_PUSH = { tools: {}, messages: [] as string[] }

/**
 * React hook — returns PlatformContext state (for UI affordances) AND
 * pushes the discovered tools + resource messages into Qurator's context.
 */
export function usePlatformContext() {
  const store = redux.useStore()

  const [state, setState] = React.useState<Mcp.PlatformContextState>(() =>
    Mcp.PlatformContextState.Loading(),
  )

  const url = React.useMemo(getMcpUrl, [])
  const client = React.useMemo(
    () =>
      Mcp.make({
        url,
        getToken: () =>
          Eff.Effect.suspend(() => {
            const token = selectToken(store.getState())
            return token
              ? Eff.Effect.succeed(token)
              : Eff.Effect.fail(new Mcp.McpAuthError())
          }),
      }),
    [url, store],
  )

  React.useEffect(() => {
    const fiber = runtime.runFork(Mcp.loadContext(client))
    fiber.addObserver((exit) => {
      if (Eff.Exit.isSuccess(exit)) {
        setState(exit.value)
        if (exit.value._tag === 'Error') {
          LOGGER.warn('platform: bootstrap failed:', exit.value.error)
        }
      }
      // On interrupt/failure (fiber killed during unmount) we let the state
      // stay in Loading — the component is going away.
    })
    return () => {
      runtime.runFork(Eff.Fiber.interrupt(fiber))
    }
  }, [client])

  Context.usePushContext(
    React.useMemo(
      () =>
        state._tag === 'Ready'
          ? { tools: state.tools, messages: state.messages }
          : EMPTY_PUSH,
      [state],
    ),
  )

  return state
}

export { usePlatformContext as use }
