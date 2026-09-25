/**
 * Live proof, opt-in: drives the real `Relay.ts` over the real `fetch` at a
 * running inference relay. Every other spec mocks the transport, and a mocked
 * transport cannot prove the wire contract. Set QUILT_LIVE_INFERENCE_URL to
 * a relay base (e.g. http://127.0.0.1:8940/inference) to enable.
 */
import * as Eff from 'effect'
import { describe, expect, it, vi } from 'vitest'

import * as Content from './Content'
import * as LLM from './LLM'
import * as Relay from './Relay'

vi.mock('constants/config', () => ({ default: {} }))

const URL = process.env.QUILT_LIVE_INFERENCE_URL
const MODEL = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'

const run = (prompt: LLM.Prompt) =>
  Eff.Effect.runPromise(
    Eff.Effect.gen(function* () {
      const llm = yield* LLM.LLM
      return yield* llm.converse(prompt, { inferenceConfig: { maxTokens: 20 } })
    }).pipe(
      Eff.Effect.provide(
        Relay.LLMRelay({
          url: URL!,
          modelId: Eff.Effect.succeed(MODEL),
          getToken: () => Eff.Effect.succeed('caller-session'),
        }),
      ),
    ),
  )

const text = (res: Awaited<ReturnType<typeof run>>) =>
  Eff.Option.getOrThrow(res.content)
    .map((b) => (b._tag === 'Text' ? b.text : ''))
    .join('')

describe.skipIf(!URL)('Relay (live)', () => {
  it('round-trips a conversation through the relay to a real model', async () => {
    const res = await run({
      system: 'Answer exactly as instructed.',
      messages: [
        {
          role: 'user',
          content: Content.PromptMessageContentBlock.Text({
            text: 'Reply exactly: catalog live',
          }),
        },
      ],
    })
    expect(text(res)).toMatch(/catalog live/i)
  }, 60_000)

  it('carries a document through as bytes the model can read', async () => {
    const pdf = new TextEncoder().encode(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj 4 0 obj<</Length 52>>stream\nBT /F1 12 Tf 72 700 Td (Viability was 42 percent.) Tj ET\nendstream endobj 5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>',
    )
    const res = await run({
      system: 'Answer with the number only.',
      messages: [
        {
          role: 'user',
          content: Content.PromptMessageContentBlock.Document({
            name: 'probe',
            format: 'pdf',
            source: new Blob([pdf]),
          }),
        },
        {
          role: 'user',
          content: Content.PromptMessageContentBlock.Text({
            text: 'What percent viability?',
          }),
        },
      ],
    })
    expect(text(res)).toMatch(/42/)
  }, 60_000)
})
