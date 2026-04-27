/**
 * Mcp tests — content mapping, tool descriptor construction, loadContext.
 *
 * Scope: pure bridge + bootstrap logic. We stub the `McpClient` service with
 * Effect-returning methods — no fetch, no React. Wire-level HTTP is covered
 * by manual e2e against the deployed PMS.
 */

import * as Eff from 'effect'
import { describe, expect, it } from 'vitest'

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

describe('PlatformMcpContext/Mcp', () => {
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
      expect(state.status).toBe('ready')
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
      expect(state.status).toBe('ready')
      expect(Object.keys(state.tools)).toEqual(['mcp__platform__x'])
      expect(state.messages).toEqual([])
    })

    it('reports error state when initialize fails — never throws', async () => {
      const client = stubClient({
        initialize: () =>
          Eff.Effect.fail(new Mcp.McpTransportError({ detail: 'DNS fail' })),
      })
      const state = await Eff.Effect.runPromise(Mcp.loadContext(client))
      expect(state.status).toBe('error')
      expect(state.error?._tag).toBe('McpTransportError')
      expect(state.tools).toEqual({})
      expect(state.messages).toEqual([])
    })

    it('reports error state when listTools fails after successful initialize', async () => {
      const client = stubClient({
        listTools: () =>
          Eff.Effect.fail(new Mcp.McpRpcError({ code: -32603, rpcMessage: 'Internal' })),
      })
      const state = await Eff.Effect.runPromise(Mcp.loadContext(client))
      expect(state.status).toBe('error')
      expect(state.error?._tag).toBe('McpRpcError')
    })
  })
})
