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
    url: 'https://reg.example/api/inference',
    modelId: Eff.Effect.succeed('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    getToken: () => Eff.Effect.succeed('session-jwt'),
    ...over,
  })

const userText = (text: string): LLM.PromptMessage => ({
  role: 'user',
  content: Content.PromptMessageContentBlock.Text({ text }),
})

afterEach(() => vi.unstubAllGlobals())

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers })

const busy = (headers?: Record<string, string>) =>
  json(429, { message: 'Too many inference requests', error_code: 'Busy' }, headers)

// Answers with each response in turn, repeating the last.
const sequence = (...responses: (() => Response)[]) => {
  let n = 0
  return install(async () => responses[Math.min(n++, responses.length - 1)]())
}

// Lets the in-flight fetch settle so the converse fiber reaches its next sleep.
const settle = Eff.Effect.promise(() => new Promise((r) => setTimeout(r, 0)))
const advance = (d: Eff.Duration.DurationInput) =>
  Eff.Effect.zipRight(Eff.TestClock.adjust(d), settle)

type Converse = Eff.Fiber.RuntimeFiber<
  Eff.Effect.Effect.Success<ReturnType<LLM.LLM['Type']['converse']>>,
  LLM.LLMError
>

const clocked = <A, E>(test: (fiber: Converse) => Eff.Effect.Effect<A, E>) =>
  Eff.Effect.runPromise(
    Eff.Effect.gen(function* () {
      const llm = yield* LLM.LLM
      const fiber = yield* Eff.Effect.fork(
        llm.converse({ system: 's', messages: [userText('x')] }),
      )
      yield* settle
      return yield* test(fiber)
    }).pipe(Eff.Effect.provide(layer()), Eff.Effect.provide(Eff.TestContext.TestContext)),
  )

const failureOf = (fiber: Converse) =>
  Eff.Effect.map(Eff.Effect.flip(Eff.Fiber.join(fiber)), (e) => e.message)

describe('Relay', () => {
  it('posts the Converse body to the relay with the session as a bearer', async () => {
    const spy = install(async () => new Response(okBody('hi'), { status: 200 }))
    const res = await run(layer(), { system: 'sys', messages: [userText('hello')] })

    expect(spy).toHaveBeenCalledOnce()
    const [url, init] = spy.mock.calls[0]
    // The model id carries a ':' and is one path segment; the relay forwards it as sent.
    expect(url).toBe(
      'https://reg.example/api/inference/model/us.anthropic.claude-sonnet-4-5-20250929-v1%3A0/converse',
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

  describe('when the relay is busy', () => {
    it('waits the registry hint of 10 s when Retry-After is unreadable', async () => {
      const spy = sequence(busy, () => new Response(okBody('queued'), { status: 200 }))
      const res = await clocked((fiber) =>
        Eff.Effect.gen(function* () {
          yield* advance('9 seconds')
          expect(spy).toHaveBeenCalledOnce()
          yield* advance('1 second')
          expect(spy).toHaveBeenCalledTimes(2)
          return yield* Eff.Fiber.join(fiber)
        }),
      )
      expect(Eff.Option.getOrThrow(res.content)).toEqual([
        Content.ResponseMessageContentBlock.Text({ text: 'queued' }),
      ])
    })

    it('waits a readable Retry-After', async () => {
      const spy = sequence(
        () => busy({ 'retry-after': '3' }),
        () => new Response(okBody('ok'), { status: 200 }),
      )
      await clocked(() =>
        Eff.Effect.gen(function* () {
          yield* advance('2 seconds')
          expect(spy).toHaveBeenCalledOnce()
          yield* advance('1 second')
          expect(spy).toHaveBeenCalledTimes(2)
        }),
      )
    })

    it('caps a long Retry-After at 15 s', async () => {
      const spy = sequence(
        () => busy({ 'retry-after': '120' }),
        () => new Response(okBody('ok'), { status: 200 }),
      )
      await clocked(() =>
        Eff.Effect.gen(function* () {
          yield* advance('14 seconds')
          expect(spy).toHaveBeenCalledOnce()
          yield* advance('1 second')
          expect(spy).toHaveBeenCalledTimes(2)
        }),
      )
    })

    it('gives up after about a minute with a plain message', async () => {
      const spy = sequence(busy)
      const message = await clocked((fiber) =>
        Eff.Effect.gen(function* () {
          for (let i = 0; i < 6; i++) yield* advance('10 seconds')
          return yield* failureOf(fiber)
        }),
      )
      expect(spy).toHaveBeenCalledTimes(7)
      expect(message).toBe('Qurator is busy with other requests. Try again in a minute.')
    })
  })

  it('fails at once on an unavailable gateway', async () => {
    const spy = sequence(() =>
      json(503, {
        message: 'The gateway endpoint is unavailable on this stack.',
        error_code: 'NotAvailable',
      }),
    )
    const message = await clocked((fiber) =>
      Eff.Effect.gen(function* () {
        expect(Eff.Option.isSome(yield* Eff.Fiber.poll(fiber))).toBe(true)
        return yield* failureOf(fiber)
      }),
    )
    expect(spy).toHaveBeenCalledOnce()
    expect(message).toBe('The gateway endpoint is unavailable on this stack.')
  })

  it('backs off exponentially on a server error, then surfaces it', async () => {
    const spy = sequence(() => json(500, { message: 'boom' }))
    const message = await clocked((fiber) =>
      Eff.Effect.gen(function* () {
        for (const [wait, calls] of [
          ['300 millis', 2],
          ['600 millis', 3],
          ['1200 millis', 4],
        ] as const) {
          yield* advance(Eff.Duration.decode(wait).pipe(Eff.Duration.subtract(1)))
          expect(spy).toHaveBeenCalledTimes(calls - 1)
          yield* advance('1 millis')
          expect(spy).toHaveBeenCalledTimes(calls)
        }
        return yield* failureOf(fiber)
      }),
    )
    expect(message).toBe('Inference error (HTTP 500): boom')
  })

  it("waits a provider throttle's readable Retry-After over the backoff", async () => {
    const spy = sequence(
      () => json(429, { message: 'Too many tokens' }, { 'retry-after': '5' }),
      () => new Response(okBody('ok'), { status: 200 }),
    )
    await clocked(() =>
      Eff.Effect.gen(function* () {
        yield* advance('4999 millis')
        expect(spy).toHaveBeenCalledOnce()
        yield* advance('1 millis')
        expect(spy).toHaveBeenCalledTimes(2)
      }),
    )
  })

  it.each([
    [
      'a server error then busy',
      [() => json(500, {}), busy],
      ['300 millis', '10 seconds'],
    ],
    [
      'busy then a server error',
      [busy, () => json(500, {})],
      ['10 seconds', '300 millis'],
    ],
  ] as const)('waits each in turn on %s', async (_, failures, waits) => {
    const spy = sequence(...failures, () => new Response(okBody('ok'), { status: 200 }))
    await clocked(() =>
      Eff.Effect.gen(function* () {
        yield* advance(waits[0])
        expect(spy).toHaveBeenCalledTimes(2)
        yield* advance(waits[1])
        expect(spy).toHaveBeenCalledTimes(3)
      }),
    )
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
