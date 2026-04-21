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
 * token. If `initialize` / `tools/list` fails, we still render the chat — MCP
 * tools just won't appear.
 *
 * URL defaults to `${registryUrl}/mcp/platform/mcp`. Override for local dev
 * via `localStorage.setItem('QUILT_MCP_URL', '…')` (same pattern as
 * `QUILT_BEDROCK_MODEL_ID`).
 */

import * as React from 'react'
import * as redux from 'react-redux'

import cfg from 'constants/config'
import * as authSelectors from 'containers/Auth/selectors'
import * as Log from 'utils/Logging'
import * as XML from 'utils/XML'

import * as Context from '../Context'
import * as Tool from '../Tool'

import * as Bridge from './bridge'
import * as Client from './client'

const MODULE = 'PlatformMcpContext'
const LOGGER = Log.default.getLogger(MODULE)

const MCP_URL_KEY = 'QUILT_MCP_URL'
const TOOL_PREFIX = 'mcp__platform__'

function getMcpUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const override = localStorage.getItem(MCP_URL_KEY)
    if (override) return override
  }
  return `${cfg.registryUrl}/mcp/platform/mcp`
}

interface McpContextState {
  status: 'loading' | 'ready' | 'error'
  error?: Error
  tools: Tool.Collection
  messages: string[]
}

const INITIAL_STATE: McpContextState = {
  status: 'loading',
  tools: {},
  messages: [],
}

/**
 * Fetch tools and optional resource context from PMS once per client.
 * Never throws — captures errors in state for the UI to surface.
 */
async function loadContext(client: Client.McpClient): Promise<McpContextState> {
  try {
    await client.initialize()
    const mcpTools = await client.listTools()
    const tools: Tool.Collection = {}
    for (const t of mcpTools) {
      tools[`${TOOL_PREFIX}${t.name}`] = Bridge.buildTool(client, t)
    }

    const messages: string[] = []
    try {
      const syntax = await client.readResource('quilt-platform://search_syntax')
      const text = syntax.contents
        .map((c) => c.text ?? '')
        .join('\n')
        .trim()
      if (text) messages.push(XML.tag('platform-mcp-search-syntax', {}, text).toString())
    } catch (e) {
      LOGGER.debug('search_syntax resource unavailable:', e)
    }

    return { status: 'ready', tools, messages }
  } catch (e) {
    LOGGER.warn('mcp: initialize/listTools failed:', e)
    return {
      status: 'error',
      error: e instanceof Error ? e : new Error(String(e)),
      tools: {},
      messages: [],
    }
  }
}

/**
 * React hook — returns MCP context state (for UI affordances) AND pushes
 * the discovered tools + resource messages into Qurator's context.
 */
export function usePlatformMcpContext() {
  const tokens = redux.useSelector(authSelectors.tokens)
  const tokenRef = React.useRef<string | null>(null)
  tokenRef.current = (tokens && (tokens as { token?: string }).token) || null

  const [state, setState] = React.useState<McpContextState>(INITIAL_STATE)

  const url = React.useMemo(getMcpUrl, [])
  const client = React.useMemo(
    () => new Client.McpClient({ url, getToken: () => tokenRef.current }),
    [url],
  )

  React.useEffect(() => {
    let cancelled = false
    loadContext(client).then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
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
