/**
 * Mcp tests — content mapping, tool descriptor construction, loadContext.
 *
 * Scope: pure bridge + bootstrap logic. We stub the `McpClient` service with
 * Effect-returning methods — no fetch, no React. Wire-level HTTP is covered
 * by manual e2e against the deployed PMS.
 */

import * as Eff from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Content from '../Content'
import * as Tool from '../Tool'

import * as Mcp from './Mcp'

const runToResult = async (
  eff: Eff.Effect.Effect<Eff.Option.Option<Tool.Result>, never, never>,
): Promise<Tool.Result> => {
  const out = await Eff.Effect.runPromise(eff)
  expect(Eff.Option.isSome(out)).toBe(true)
  return Eff.Option.getOrThrow(out)
}

const stubClient = (overrides: Partial<Mcp.McpClient> = {}): Mcp.McpClient => ({
  initialize: () => Eff.Effect.void,
  listTools: () => Eff.Effect.succeed([]),
  callTool: () => Eff.Effect.succeed({ content: [] }),
  readResource: () =>
    Eff.Effect.fail(new Mcp.McpProtocolError({ detail: 'stub: not provided' })),
  ...overrides,
})

describe('PlatformContext/Mcp', () => {
  describe('mapContent', () => {
    it('maps text blocks directly', () => {
      const out = Mcp.mapContent({ type: 'text', text: 'hello' })
      expect(out).toEqual(Content.ToolResultContentBlock.Text({ text: 'hello' }))
    })

    it('maps png images to Image blocks', () => {
      const out = Mcp.mapContent({
        type: 'image',
        data: 'AAAA',
        mimeType: 'image/png',
      })
      expect(out).toEqual(
        Content.ToolResultContentBlock.Image({ format: 'png', source: 'AAAA' }),
      )
    })

    it('falls back to Text when image mimeType is unsupported', () => {
      const out = Mcp.mapContent({
        type: 'image',
        data: 'AAAA',
        mimeType: 'image/svg+xml',
      })
      expect(out._tag).toBe('Text')
    })

    it('unwraps embedded resource text', () => {
      const out = Mcp.mapContent({
        type: 'resource',
        resource: { uri: 'foo://bar', text: 'body' },
      })
      expect(out).toEqual(Content.ToolResultContentBlock.Text({ text: 'body' }))
    })

    it('renders unknown blocks as JSON so the LLM still sees something', () => {
      const out = Mcp.mapContent({ type: 'future-thing' } as Mcp.McpContent)
      expect(out._tag).toBe('Text')
      expect((out as { text: string }).text).toContain('future-thing')
    })
  })

  describe('buildTool', () => {
    const mcpTool: Mcp.McpToolDescriptor = {
      name: 'search_packages',
      description: 'Search packages',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    }

    it('surfaces description and passes inputSchema through to Bedrock', () => {
      const d = Mcp.buildTool(stubClient(), mcpTool)
      expect(d.description).toBe('Search packages')
      const schema = d.schema as unknown as {
        type: string
        properties: { query: object }
      }
      expect(schema.type).toBe('object')
      expect(schema.properties.query).toEqual({ type: 'string' })
    })

    it('maps success results to Tool.succeed with mapped content', async () => {
      const client = stubClient({
        callTool: () =>
          Eff.Effect.succeed({
            content: [{ type: 'text', text: 'ok' } as Mcp.McpContent],
          }),
      })
      const d = Mcp.buildTool(client, mcpTool)
      const result = await runToResult(d.executor({ query: 'x' }))
      expect(result.status).toBe('success')
      expect(result.content).toEqual([
        Content.ToolResultContentBlock.Text({ text: 'ok' }),
      ])
    })

    it('maps isError results to Tool.fail', async () => {
      const client = stubClient({
        callTool: () =>
          Eff.Effect.succeed({
            isError: true,
            content: [{ type: 'text', text: 'boom' } as Mcp.McpContent],
          }),
      })
      const d = Mcp.buildTool(client, mcpTool)
      const result = await runToResult(d.executor({}))
      expect(result.status).toBe('error')
      expect(result.content).toEqual([
        Content.ToolResultContentBlock.Text({ text: 'boom' }),
      ])
    })

    it('catches transport errors and surfaces them as Tool.fail', async () => {
      const client = stubClient({
        callTool: () =>
          Eff.Effect.fail(new Mcp.McpTransportError({ detail: 'network down' })),
      })
      const d = Mcp.buildTool(client, mcpTool)
      const result = await runToResult(d.executor({}))
      expect(result.status).toBe('error')
      expect((result.content[0] as { text: string }).text).toContain('search_packages')
      expect((result.content[0] as { text: string }).text).toContain('network down')
    })

    it('catches JSON-RPC errors and surfaces their code/message', async () => {
      const client = stubClient({
        callTool: () =>
          Eff.Effect.fail(
            new Mcp.McpRpcError({ code: -32000, rpcMessage: 'server boom' }),
          ),
      })
      const d = Mcp.buildTool(client, mcpTool)
      const result = await runToResult(d.executor({}))
      expect(result.status).toBe('error')
      expect((result.content[0] as { text: string }).text).toContain('-32000')
      expect((result.content[0] as { text: string }).text).toContain('server boom')
    })
  })

  describe('loadContext', () => {
    it('discovers tools and renders search_syntax as an XML-tagged message', async () => {
      const client = stubClient({
        listTools: () =>
          Eff.Effect.succeed([
            {
              name: 'search_packages',
              description: 'Search',
              inputSchema: { type: 'object' },
            },
          ]),
        readResource: () =>
          Eff.Effect.succeed({
            contents: [{ uri: 'quilt-platform://search_syntax', text: 'QUERY SYNTAX' }],
          }),
      })
      const state = await Eff.Effect.runPromise(Mcp.loadContext(client))
      expect(state._tag).toBe('Ready')
      if (state._tag !== 'Ready') throw new Error('expected Ready')
      expect(Object.keys(state.tools)).toEqual(['mcp__platform__search_packages'])
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0]).toContain('platform-mcp-search-syntax')
      expect(state.messages[0]).toContain('QUERY SYNTAX')
    })

    it('still renders tools when search_syntax is unavailable', async () => {
      const client = stubClient({
        listTools: () =>
          Eff.Effect.succeed([
            { name: 'x', description: 'x', inputSchema: { type: 'object' } },
          ]),
        readResource: () =>
          Eff.Effect.fail(
            new Mcp.McpRpcError({ code: -32602, rpcMessage: 'Resource not found' }),
          ),
      })
      const state = await Eff.Effect.runPromise(Mcp.loadContext(client))
      expect(state._tag).toBe('Ready')
      if (state._tag !== 'Ready') throw new Error('expected Ready')
      expect(Object.keys(state.tools)).toEqual(['mcp__platform__x'])
      expect(state.messages).toEqual([])
    })

    it('reports Error state when initialize fails — never throws', async () => {
      const client = stubClient({
        initialize: () =>
          Eff.Effect.fail(new Mcp.McpTransportError({ detail: 'DNS fail' })),
      })
      const state = await Eff.Effect.runPromise(Mcp.loadContext(client))
      expect(state._tag).toBe('Error')
      if (state._tag !== 'Error') throw new Error('expected Error')
      expect(state.error._tag).toBe('McpTransportError')
    })

    it('reports Error state when listTools fails after successful initialize', async () => {
      const client = stubClient({
        listTools: () =>
          Eff.Effect.fail(new Mcp.McpRpcError({ code: -32603, rpcMessage: 'Internal' })),
      })
      const state = await Eff.Effect.runPromise(Mcp.loadContext(client))
      expect(state._tag).toBe('Error')
      if (state._tag !== 'Error') throw new Error('expected Error')
      expect(state.error._tag).toBe('McpRpcError')
    })

    it('propagates McpAuthError from getToken (via callTool path)', async () => {
      // Synthesize: a stub client whose initialize fails with McpAuthError —
      // standing in for a `make()`-built client whose `getToken` resolves to
      // `McpAuthError`. Verifies loadContext surfaces auth failure under the
      // discriminated union.
      const client = stubClient({
        initialize: () => Eff.Effect.fail(new Mcp.McpAuthError()),
      })
      const state = await Eff.Effect.runPromise(Mcp.loadContext(client))
      expect(state._tag).toBe('Error')
      if (state._tag !== 'Error') throw new Error('expected Error')
      expect(state.error._tag).toBe('McpAuthError')
      expect(state.error.message).toBe('MCP: no session token')
    })
  })

  describe('make() — wire-level integration', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    const stubFetchEcho = (
      record: Array<{ url: string; init?: RequestInit; body?: unknown }>,
    ): typeof fetch =>
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : undefined
        record.push({ url: String(url), init, body })
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body?.id ?? 'echo',
            result: { tools: [] },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }) as unknown as typeof fetch

    it('generates a fresh JSON-RPC id per call (uniqueness, not format)', async () => {
      const calls: Array<{ url: string; init?: RequestInit; body?: any }> = []
      vi.stubGlobal('fetch', stubFetchEcho(calls))

      const client = Mcp.make({
        url: 'https://example.invalid/mcp',
        getToken: () => Eff.Effect.succeed('abc'),
      })
      await Eff.Effect.runPromise(client.listTools())
      await Eff.Effect.runPromise(client.listTools())

      expect(calls).toHaveLength(2)
      expect(calls[0].body.id).toBeTruthy()
      expect(calls[1].body.id).toBeTruthy()
      expect(calls[0].body.id).not.toEqual(calls[1].body.id)
    })

    it('forwards bearer token from getToken Effect', async () => {
      const calls: Array<{ url: string; init?: RequestInit; body?: any }> = []
      vi.stubGlobal('fetch', stubFetchEcho(calls))

      const client = Mcp.make({
        url: 'https://example.invalid/mcp',
        getToken: () => Eff.Effect.succeed('the-token'),
      })
      await Eff.Effect.runPromise(client.listTools())

      const headers = (calls[0].init?.headers ?? {}) as Record<string, string>
      expect(headers.Authorization).toBe('Bearer the-token')
    })

    it('propagates McpAuthError without firing fetch when getToken fails', async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)

      const client = Mcp.make({
        url: 'https://example.invalid/mcp',
        getToken: () => Eff.Effect.fail(new Mcp.McpAuthError()),
      })
      const exit = await Eff.Effect.runPromiseExit(client.listTools())

      expect(Eff.Exit.isFailure(exit)).toBe(true)
      if (Eff.Exit.isFailure(exit)) {
        const failure = Eff.Cause.failureOption(exit.cause)
        expect(Eff.Option.isSome(failure)).toBe(true)
        if (Eff.Option.isSome(failure)) {
          expect(failure.value._tag).toBe('McpAuthError')
        }
      }
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('PlatformContextState constructors', () => {
    it('Loading produces a tagged value with no fields', () => {
      const s = Mcp.PlatformContextState.Loading()
      expect(s._tag).toBe('Loading')
      expect(Object.keys(s)).toEqual(['_tag'])
    })

    it('Ready carries tools and messages', () => {
      const s = Mcp.PlatformContextState.Ready({ tools: {}, messages: ['hi'] })
      expect(s._tag).toBe('Ready')
      if (s._tag !== 'Ready') throw new Error('expected Ready')
      expect(s.messages).toEqual(['hi'])
    })

    it('Error carries the McpError instance verbatim', () => {
      const err = new Mcp.McpTransportError({ detail: 'x' })
      const s = Mcp.PlatformContextState.Error({ error: err })
      expect(s._tag).toBe('Error')
      if (s._tag !== 'Error') throw new Error('expected Error')
      expect(s.error).toBe(err)
    })
  })
})
