/**
 * Mcp tests — wire-level make() integration, content mapping, SSE parsing.
 *
 * Pure bridge logic plus end-to-end wire calls through a stubbed
 * `FetchHttpClient.Fetch` service. Lifecycle / state-machine coverage
 * lives in Connectors.spec.ts.
 */

import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as Eff from 'effect'
import { describe, expect, it, vi } from 'vitest'

import * as Content from '../Content'

import * as Mcp from './Mcp'

describe('Connectors/Mcp', () => {
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

  describe('make() — wire-level integration', () => {
    /**
     * Inject a stub fetch via the `FetchHttpClient.Fetch` service tag — the
     * canonical Effect way. `FetchHttpClient.layer` reads the Fetch tag
     * from fiber context; providing it overrides the default
     * `globalThis.fetch` lookup deterministically, no globalThis pollution.
     */
    const captureCalls = (
      respond: () => Response,
    ): {
      fetchSpy: ReturnType<typeof vi.fn>
      calls: Array<{ url: string; init?: RequestInit; body?: any }>
    } => {
      const calls: Array<{ url: string; init?: RequestInit; body?: any }> = []
      const fetchSpy = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        // `bodyText`/`bodyJson` in @effect/platform convert payloads to
        // Uint8Array before invoking fetch — decode before JSON.parse.
        let body: any = undefined
        if (init?.body) {
          const raw = init.body
          const text =
            typeof raw === 'string' ? raw : new TextDecoder().decode(raw as Uint8Array)
          body = JSON.parse(text)
        }
        calls.push({ url: String(url), init, body })
        return respond()
      })
      return { fetchSpy, calls }
    }

    const okResponse = () =>
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'echo',
          result: { tools: [] },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )

    const withFetch = <A, E>(
      effect: Eff.Effect.Effect<A, E>,
      fetchSpy: ReturnType<typeof vi.fn>,
    ) =>
      effect.pipe(
        Eff.Effect.provideService(
          FetchHttpClient.Fetch,
          fetchSpy as unknown as typeof fetch,
        ),
      )

    it('generates a fresh JSON-RPC id per call (uniqueness, not format)', async () => {
      const { fetchSpy, calls } = captureCalls(okResponse)

      const client = Mcp.make({
        url: 'https://example.invalid/mcp',
        getToken: () => Eff.Effect.succeed('abc'),
      })
      await Eff.Effect.runPromise(withFetch(client.listTools(), fetchSpy))
      await Eff.Effect.runPromise(withFetch(client.listTools(), fetchSpy))

      expect(calls).toHaveLength(2)
      expect(calls[0].body.id).toBeTruthy()
      expect(calls[1].body.id).toBeTruthy()
      expect(calls[0].body.id).not.toEqual(calls[1].body.id)
    })

    it('forwards bearer token from getToken Effect', async () => {
      const { fetchSpy, calls } = captureCalls(okResponse)

      const client = Mcp.make({
        url: 'https://example.invalid/mcp',
        getToken: () => Eff.Effect.succeed('the-token'),
      })
      await Eff.Effect.runPromise(withFetch(client.listTools(), fetchSpy))

      const headers = (calls[0].init?.headers ?? {}) as Record<string, string>
      expect(headers.authorization).toBe('Bearer the-token')
    })

    it('propagates McpAuthError without firing fetch when getToken fails', async () => {
      const fetchSpy = vi.fn()

      const client = Mcp.make({
        url: 'https://example.invalid/mcp',
        getToken: () => Eff.Effect.fail(new Mcp.McpAuthError()),
      })
      const exit = await Eff.Effect.runPromiseExit(
        withFetch(client.listTools(), fetchSpy),
      )

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

    it('decodes a malformed envelope to McpProtocolError', async () => {
      // Server returns 200 OK with JSON missing `jsonrpc`/`id` — schema decode fails.
      const { fetchSpy } = captureCalls(
        () =>
          new Response(JSON.stringify({ result: { tools: [] } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      )

      const client = Mcp.make({
        url: 'https://example.invalid/mcp',
        getToken: () => Eff.Effect.succeed('t'),
      })
      const exit = await Eff.Effect.runPromiseExit(
        withFetch(client.listTools(), fetchSpy),
      )

      expect(Eff.Exit.isFailure(exit)).toBe(true)
      if (Eff.Exit.isFailure(exit)) {
        const failure = Eff.Cause.failureOption(exit.cause)
        if (Eff.Option.isSome(failure)) {
          expect(failure.value._tag).toBe('McpProtocolError')
          expect(failure.value.message).toContain('envelope')
        }
      }
    })

    it('decodes tools/list result via Schema; bad shape → McpProtocolError', async () => {
      // Envelope is well-formed; result.tools is a string (not array).
      const { fetchSpy } = captureCalls(
        () =>
          new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 'x',
              result: { tools: 'not-an-array' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      )

      const client = Mcp.make({
        url: 'https://example.invalid/mcp',
        getToken: () => Eff.Effect.succeed('t'),
      })
      const exit = await Eff.Effect.runPromiseExit(
        withFetch(client.listTools(), fetchSpy),
      )

      expect(Eff.Exit.isFailure(exit)).toBe(true)
      if (Eff.Exit.isFailure(exit)) {
        const failure = Eff.Cause.failureOption(exit.cause)
        if (Eff.Option.isSome(failure)) {
          expect(failure.value._tag).toBe('McpProtocolError')
          expect(failure.value.message).toContain('tools/list')
        }
      }
    })

    it('handles SSE responses (FastMCP stateless_http=True path)', async () => {
      // FastMCP emits the response as SSE: `data: <json>\r\n\r\n`.
      const { fetchSpy, calls } = captureCalls(
        () =>
          new Response('data: {"jsonrpc":"2.0","id":"x","result":{"tools":[]}}\r\n\r\n', {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          }),
      )

      const client = Mcp.make({
        url: 'https://example.invalid/mcp',
        getToken: () => Eff.Effect.succeed('t'),
      })
      const tools = await Eff.Effect.runPromise(withFetch(client.listTools(), fetchSpy))

      expect(tools).toEqual([])
      expect(calls).toHaveLength(1)
    })
  })

  describe('parseSseToJson', () => {
    it('parses a single CRLF-separated SSE event', () => {
      expect(Mcp.parseSseToJson('data: {"a":1}\r\n\r\n')).toEqual({ a: 1 })
    })

    it('joins multi-line data', () => {
      expect(Mcp.parseSseToJson('data: {\ndata:   "a": 1\ndata: }\n\n')).toEqual({ a: 1 })
    })

    it('returns null on empty stream', () => {
      expect(Mcp.parseSseToJson('')).toBeNull()
    })

    it('throws on malformed JSON in data:', () => {
      expect(() => Mcp.parseSseToJson('data: {not-json}\n\n')).toThrow()
    })
  })
})
