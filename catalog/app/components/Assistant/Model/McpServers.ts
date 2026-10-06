/**
 * Prototype source of extra MCP servers for Qurator, kept in this browser.
 *
 * Stands in for the admin-only registry list (`Query.mcpServers`) so the Qurator
 * side can be tried without a registry change. It governs nothing: anyone can
 * edit their own `localStorage`, and a header value stored here is readable by
 * this browser's user. The production design keeps both in the registry.
 */
import * as Connectors from './Connectors'
import * as Mcp from './Connectors/Mcp'

const STORAGE_KEY = 'QUILT_MCP_SERVERS_PROTOTYPE'

export interface Server {
  readonly slug: string
  readonly title: string
  readonly url: string
  readonly hint?: string
  readonly headerName?: string
  readonly headerValue?: string
  readonly enabled: boolean
}

// `<slug>__<tool>` must fit Bedrock's tool-name rule; `platform` is the built-in.
const SLUG_RE = /^[a-z][a-z0-9_]{0,23}$/
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(['platform'])

export function validate(s: Server, others: readonly Server[]): string | null {
  if (!SLUG_RE.test(s.slug)) return 'Id: lowercase letters, digits and _, up to 24'
  if (RESERVED_SLUGS.has(s.slug)) return `Id "${s.slug}" is reserved`
  if (others.some((o) => o.slug === s.slug)) return `Id "${s.slug}" is taken`
  if (!s.title.trim()) return 'Title is required'
  let url: URL
  try {
    url = new URL(s.url)
  } catch {
    return 'URL is not valid'
  }
  if (url.protocol !== 'https:') return 'URL must be https'
  if (!!s.headerName !== !!s.headerValue) return 'Header needs both a name and a value'
  return null
}

export function read(): Server[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function write(servers: readonly Server[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(servers))
  } catch {
    // Storage blocked: the list just doesn't persist.
  }
}

export function backend(s: Server): Connectors.Backend {
  return s.headerName && s.headerValue
    ? Mcp.withHeaders({ url: s.url, headers: { [s.headerName]: s.headerValue } })
    : Mcp.anonymous({ url: s.url })
}

export function toConnectorConfigs(
  servers: readonly Server[],
): Connectors.ConnectorConfig[] {
  return servers
    .filter((s) => s.enabled && !RESERVED_SLUGS.has(s.slug))
    .map((s) => ({
      id: s.slug,
      title: s.title,
      hint: s.hint || undefined,
      optional: true,
      thirdParty: true,
      backend: backend(s),
    }))
}
