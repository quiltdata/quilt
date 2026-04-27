/**
 * PlatformMcpContext — bridge from Quilt Platform MCP Server to Qurator.
 *
 * Runs once per Assistant session:
 *   1. `initialize` + `tools/list` against the MCP server.
 *   2. For each MCP tool, create a Qurator `Tool.Descriptor` prefixed with
 *      `mcp__platform__`. Executor proxies to `tools/call`.
 *   3. Read the `quilt-platform://search_syntax` resource as an XML-tagged
 *      context message so the LLM can construct better search queries.
 *   4. Push the resulting `{ tools, messages }` into the shared context.
 *
 * The MCP server runs stateless HTTP, so there's no persistent connection to
 * manage. Every tool call is an independent POST with the current session
 * token. Bootstrap runs as an Effect on the shared runtime; fiber interruption
 * aborts in-flight fetches when the Provider unmounts.
 *
 * URL defaults to `${registryUrl}/mcp/platform/mcp`. Override for local dev
 * via `localStorage.setItem('QUILT_MCP_URL', '…')` (same pattern as
 * `QUILT_BEDROCK_MODEL_ID`).
 */

import * as Eff from 'effect'
import * as React from 'react'
import * as redux from 'react-redux'

import cfg from 'constants/config'
import * as authSelectors from 'containers/Auth/selectors'
import { runtime } from 'utils/Effect'
import * as Log from 'utils/Logging'

import * as Context from '../Context'

import * as Mcp from './Mcp'

const MODULE = 'PlatformMcpContext'
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
 * React hook — returns MCP context state (for UI affordances) AND pushes
 * the discovered tools + resource messages into Qurator's context.
 */
export function usePlatformMcpContext() {
  const tokens = redux.useSelector(authSelectors.tokens)
  const tokenRef = React.useRef<string | null>(null)
  tokenRef.current = (tokens && (tokens as { token?: string }).token) || null

  const [state, setState] = React.useState<Mcp.McpContextState>(Mcp.INITIAL_STATE)

  const url = React.useMemo(getMcpUrl, [])
  const client = React.useMemo(
    () => Mcp.make({ url, getToken: () => tokenRef.current }),
    [url],
  )

  React.useEffect(() => {
    const fiber = runtime.runFork(Mcp.loadContext(client))
    fiber.addObserver((exit) => {
      if (Eff.Exit.isSuccess(exit)) {
        setState(exit.value)
        if (exit.value.status === 'error') {
          LOGGER.warn('mcp: bootstrap failed:', exit.value.error)
        }
      }
      // On interrupt/failure (fiber killed during unmount) we let the state
      // stay in `loading` — the component is going away.
    })
    return () => {
      runtime.runFork(Eff.Fiber.interrupt(fiber))
    }
  }, [client])

  Context.usePushContext(
    React.useMemo(
      () => ({ tools: state.tools, messages: state.messages }),
      [state.tools, state.messages],
    ),
  )

  return state
}

export { usePlatformMcpContext as use }
