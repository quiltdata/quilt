import * as Eff from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Content from './Content'
import * as LLM from './LLM'
import * as Relay from './Relay'

const okBody = (text: string) =>
  JSON.stringify({ output: { message: { role: 'assistant', content: [{ text }] } } })

const install = (impl: (input: string, init: RequestInit) => Promise<Response>) => {
  const spy = vi.fn(impl)
  vi.stubGlobal('fetch', spy)
  return spy
}

const run = (layer: Eff.Layer.Layer<LLM.LLM>, prompt: LLM.Prompt) =>
  Eff.Effect.runPromise(
    Eff.Effect.gen(function* () {
      const llm = yield* LLM.LLM
      return yield* llm.converse(prompt)
    }).pipe(Eff.Effect.provide(layer)),
  )

const layer = (over: Partial<Relay.RelayOptions> = {}) =>
  Relay.LLMRelay({
    url: 'https://reg.example/mcp/platform/inference',
    modelId: Eff.Effect.succeed('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    getToken: () => Eff.Effect.succeed('session-jwt'),
    ...over,
  })

const userText = (text: string): LLM.PromptMessage => ({
  role: 'user',
  content: Content.PromptMessageContentBlock.Text({ text }),
})

afterEach(() => vi.unstubAllGlobals())

describe('Relay', () => {
  it('posts the Converse body to the relay with the session as a bearer', async () => {
    const spy = install(async () => new Response(okBody('hi'), { status: 200 }))
    const res = await run(layer(), { system: 'sys', messages: [userText('hello')] })

    expect(spy).toHaveBeenCalledOnce()
    const [url, init] = spy.mock.calls[0]
    // The model id carries a ':' and is one path segment; the relay forwards it as sent.
    expect(url).toBe(
      'https://reg.example/mcp/platform/inference/model/us.anthropic.claude-sonnet-4-5-20250929-v1%3A0/converse',
    )
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer session-jwt',
    )
    const body = JSON.parse(init.body as string)
    expect(body.system).toEqual([{ text: 'sys' }])
    expect(body.messages).toEqual([{ role: 'user', content: [{ text: 'hello' }] }])
    expect(Eff.Option.getOrThrow(res.content)).toEqual([
      Content.ResponseMessageContentBlock.Text({ text: 'hi' }),
    ])
  })

  it('base64-encodes document bytes exactly as the SDK would have', async () => {
    const spy = install(async () => new Response(okBody('ok'), { status: 200 }))
    const raw = new TextEncoder().encode('%PDF-1.4 probe')
    await run(layer(), {
      system: 's',
      messages: [
        {
          role: 'user',
          content: Content.PromptMessageContentBlock.Document({
            name: 'probe',
            format: 'pdf',
            source: new Blob([raw]),
          }),
        },
      ],
    })
    const body = JSON.parse(spy.mock.calls[0][1].body as string)
    expect(body.messages[0].content[0].document.source.bytes).toBe(
      Buffer.from(raw).toString('base64'),
    )
  })

  it('base64-encodes bytes inside a tool result too', async () => {
    const spy = install(async () => new Response(okBody('ok'), { status: 200 }))
    await run(layer(), {
      system: 's',
      messages: [
        {
          role: 'user',
          content: Content.PromptMessageContentBlock.ToolResult({
            toolUseId: 't1',
            status: 'success',
            content: [
              Content.ToolResultContentBlock.Image({
                format: 'png',
                source: new Uint8Array([1, 2, 3]),
              }),
            ],
          }),
        },
      ],
    })
    const body = JSON.parse(spy.mock.calls[0][1].body as string)
    expect(body.messages[0].content[0].toolResult.content[0].image.source.bytes).toBe(
      'AQID',
    )
  })

  it('surfaces the relayed error envelope in the same shape Bedrock errors take', async () => {
    install(
      async () =>
        new Response(JSON.stringify({ message: 'AI Gateway | OperationNotFound' }), {
          status: 404,
        }),
    )
    await expect(
      run(layer(), { system: 's', messages: [userText('x')] }),
    ).rejects.toThrow(/Inference error \(HTTP 404\): AI Gateway \| OperationNotFound/)
  })

  it('retries a throttle and returns the eventual answer', async () => {
    let n = 0
    const spy = install(async () => {
      n += 1
      return n === 1
        ? new Response(JSON.stringify({ message: 'Too many requests' }), { status: 429 })
        : new Response(okBody('after retry'), { status: 200 })
    })
    const res = await run(layer(), { system: 's', messages: [userText('x')] })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(Eff.Option.getOrThrow(res.content)).toEqual([
      Content.ResponseMessageContentBlock.Text({ text: 'after retry' }),
    ])
  })

  it('does not retry a client error', async () => {
    const spy = install(
      async () => new Response(JSON.stringify({ message: 'bad' }), { status: 400 }),
    )
    await expect(
      run(layer(), { system: 's', messages: [userText('x')] }),
    ).rejects.toThrow(/HTTP 400/)
    expect(spy).toHaveBeenCalledOnce()
  })

  it('fails without a session and never fetches', async () => {
    const spy = install(async () => new Response(okBody('no'), { status: 200 }))
    await expect(
      run(layer({ getToken: () => Eff.Effect.succeed(null) }), {
        system: 's',
        messages: [userText('x')],
      }),
    ).rejects.toThrow(/No authenticated session/)
    expect(spy).not.toHaveBeenCalled()
  })
})
