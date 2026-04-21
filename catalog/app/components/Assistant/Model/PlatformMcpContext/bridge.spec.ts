/**
 * Bridge tests — content mapping + tool descriptor construction.
 *
 * Scope: the *bridge* layer only. Not testing:
 * - The JSON-RPC client wire format (thin wrapper around fetch).
 * - React lifecycle / hook behavior (covered by manual e2e).
 * - Starlette CORS middleware (library code).
 */

import * as Eff from 'effect'
import { describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: { registryUrl: 'https://registry.test' } }))

import * as Content from '../Content'
import * as Tool from '../Tool'

import * as Bridge from './bridge'
import type * as Client from './client'

const runToResult = async (
  eff: Eff.Effect.Effect<Eff.Option.Option<Tool.Result>, never, never>,
): Promise<Tool.Result> => {
  const out = await Eff.Effect.runPromise(eff)
  expect(Eff.Option.isSome(out)).toBe(true)
  return Eff.Option.getOrThrow(out)
}

const fakeClient = (result: Client.McpToolResult | Error): Client.McpClient =>
  ({
    callTool: vi.fn(async () => {
      if (result instanceof Error) throw result
      return result
    }),
  }) as unknown as Client.McpClient

describe('PlatformMcpContext/bridge', () => {
  describe('mapContent', () => {
    it('maps text blocks directly', () => {
      const out = Bridge.mapContent({ type: 'text', text: 'hello' })
      expect(out).toEqual(Content.ToolResultContentBlock.Text({ text: 'hello' }))
    })

    it('maps png images to Image blocks', () => {
      const out = Bridge.mapContent({
        type: 'image',
        data: 'AAAA',
        mimeType: 'image/png',
      })
      expect(out).toEqual(
        Content.ToolResultContentBlock.Image({ format: 'png', source: 'AAAA' }),
      )
    })

    it('falls back to Text when image mimeType is unsupported', () => {
      const out = Bridge.mapContent({
        type: 'image',
        data: 'AAAA',
        mimeType: 'image/svg+xml',
      })
      expect(out._tag).toBe('Text')
    })

    it('unwraps embedded resource text', () => {
      const out = Bridge.mapContent({
        type: 'resource',
        resource: { uri: 'foo://bar', text: 'body' },
      })
      expect(out).toEqual(Content.ToolResultContentBlock.Text({ text: 'body' }))
    })

    it('renders unknown blocks as JSON so the LLM still sees something', () => {
      const out = Bridge.mapContent({ type: 'future-thing' } as Client.McpContent)
      expect(out._tag).toBe('Text')
      expect((out as { text: string }).text).toContain('future-thing')
    })
  })

  describe('buildTool', () => {
    const mcpTool: Client.McpToolDescriptor = {
      name: 'search_packages',
      description: 'Search packages',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    }

    it('surfaces description and passes inputSchema through to Bedrock', () => {
      const d = Bridge.buildTool(fakeClient({ content: [] }), mcpTool)
      expect(d.description).toBe('Search packages')
      const schema = d.schema as unknown as {
        type: string
        properties: { query: object }
      }
      expect(schema.type).toBe('object')
      expect(schema.properties.query).toEqual({ type: 'string' })
    })

    it('maps success results to Tool.succeed with mapped content', async () => {
      const client = fakeClient({
        content: [{ type: 'text', text: 'ok' }],
      })
      const d = Bridge.buildTool(client, mcpTool)
      const result = await runToResult(d.executor({ query: 'x' }))
      expect(result.status).toBe('success')
      expect(result.content).toEqual([
        Content.ToolResultContentBlock.Text({ text: 'ok' }),
      ])
    })

    it('maps isError results to Tool.fail', async () => {
      const client = fakeClient({
        isError: true,
        content: [{ type: 'text', text: 'boom' }],
      })
      const d = Bridge.buildTool(client, mcpTool)
      const result = await runToResult(d.executor({}))
      expect(result.status).toBe('error')
      expect(result.content).toEqual([
        Content.ToolResultContentBlock.Text({ text: 'boom' }),
      ])
    })

    it('catches transport errors and surfaces them as Tool.fail', async () => {
      const client = fakeClient(new Error('network down'))
      const d = Bridge.buildTool(client, mcpTool)
      const result = await runToResult(d.executor({}))
      expect(result.status).toBe('error')
      expect((result.content[0] as { text: string }).text).toContain('search_packages')
      expect((result.content[0] as { text: string }).text).toContain('network down')
    })
  })
})
