import { describe, expect, it } from 'vitest'

import * as McpServers from './McpServers'

const server: McpServers.Server = {
  slug: 'deepwiki',
  title: 'DeepWiki',
  url: 'https://mcp.deepwiki.com/mcp',
  enabled: true,
}

describe('components/Assistant/Model/McpServers', () => {
  it('accepts a well-formed server', () => {
    expect(McpServers.validate(server, [])).toBeNull()
  })

  it('refuses the built-in id, duplicates, http and half a header', () => {
    expect(McpServers.validate({ ...server, slug: 'platform' }, [])).toMatch(/reserved/)
    expect(McpServers.validate(server, [server])).toMatch(/taken/)
    expect(McpServers.validate({ ...server, url: 'http://x.test/mcp' }, [])).toMatch(
      /https/,
    )
    expect(McpServers.validate({ ...server, headerName: 'X-API-Key' }, [])).toMatch(
      /both/,
    )
    expect(McpServers.validate({ ...server, slug: 'a__b' }, [])).toMatch(/single inner _/)
    expect(McpServers.validate({ ...server, slug: 'a_' }, [])).toMatch(/single inner _/)
    expect(McpServers.validate({ ...server, slug: 'a_b' }, [])).toBeNull()
    expect(
      McpServers.validate({ ...server, headerName: 'X Key', headerValue: 'v' }, []),
    ).toMatch(/Header name/)
  })

  it('reads back only entries the form would accept', () => {
    window.localStorage.setItem(
      'QUILT_MCP_SERVERS_PROTOTYPE',
      JSON.stringify([null, server, { ...server, url: 'http://x.test' }, server]),
    )
    try {
      expect(McpServers.read()).toEqual([server])
    } finally {
      window.localStorage.clear()
    }
  })

  it('turns only enabled servers into optional third-party connectors', () => {
    const configs = McpServers.toConnectorConfigs([
      server,
      { ...server, slug: 'off', enabled: false },
    ])
    expect(configs.map((c) => c.id)).toEqual(['deepwiki'])
    expect(configs[0].optional).toBe(true)
    expect(configs[0].thirdParty).toBe(true)
  })
})
