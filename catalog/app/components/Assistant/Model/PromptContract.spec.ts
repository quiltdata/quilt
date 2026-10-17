import * as Eff from 'effect'
import { describe, expect, it, vi } from 'vitest'

import * as Context from './Context'
import * as Conversation from './Conversation'
import { PreviewSchema, THRESHOLD } from './GlobalContext/preview'
import { SummarizeSchema } from './GlobalContext/summarize'
import * as LLM from './LLM'
import * as PromptContract from './PromptContract'
import FIXTURE from './PromptContract.fixture.json'
import * as Tool from './Tool'

vi.mock('constants/config', () => ({ default: {} }))

// The fixture is the registry's quilt_server/qurator_prompt.json plus a version.
// When the registry changes the contract, copy the file here again.

const withoutDescriptions = (schema: unknown): unknown => {
  if (Array.isArray(schema)) return schema.map(withoutDescriptions)
  if (!schema || typeof schema !== 'object') return schema
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([k]) => k !== 'description')
      .map(([k, v]) => [k, withoutDescriptions(v)]),
  )
}

const executor = () =>
  Tool.make(PreviewSchema, () => Eff.Effect.succeed(Eff.Option.none()), 'read')

describe('components/Assistant/Model/PromptContract', () => {
  describe('the local decoders', () => {
    it.each([
      ['catalog_preview', PreviewSchema],
      ['catalog_summarize', SummarizeSchema],
    ] as const)('accept exactly what the served %s schema describes', (name, schema) => {
      const served = FIXTURE.tools.find((t) => t.name === name)
      expect(served).toBeDefined()
      const { description: _, ...local } = Tool.makeJSONSchema(schema)
      expect(local).toEqual(withoutDescriptions(served!.inputSchema))
    })
  })

  describe('servedTools', () => {
    it('offers each local executor under its served description and schema', () => {
      const preview = executor()
      const tools = PromptContract.servedTools(FIXTURE, { catalog_preview: preview })
      expect(Object.keys(tools)).toEqual(['catalog_preview'])
      expect(tools.catalog_preview.description).toBe(FIXTURE.tools[0].description)
      expect(tools.catalog_preview.schema).toEqual(FIXTURE.tools[0].inputSchema)
      expect(tools.catalog_preview.executor).toBe(preview.executor)
      expect(tools.catalog_preview.effect).toBe('read')
    })

    it('offers no tool the registry does not describe', () => {
      const tools = PromptContract.servedTools(
        { ...FIXTURE, tools: [] },
        { catalog_preview: executor() },
      )
      expect(tools).toEqual({})
    })

    it('offers nothing before the contract is served', () => {
      expect(PromptContract.servedTools(null, { catalog_preview: executor() })).toEqual(
        {},
      )
    })
  })

  describe('constructPrompt', () => {
    const build = (ctx: Partial<Context.ContextShape>) =>
      Eff.Effect.runPromise(
        Eff.Effect.either(Conversation.constructPrompt([], Context.merge(ctx))),
      )

    it('frames the conversation with the served text, in order', async () => {
      const result = await build({ prompt: FIXTURE, messages: ['<stack/>'] })
      if (Eff.Either.isLeft(result)) throw result.left
      const prompt = result.right
      expect(prompt.system).toBe(FIXTURE.system)
      const [first, last] = [
        prompt.messages[0],
        prompt.messages[prompt.messages.length - 1],
      ]
      if (first.content._tag !== 'Text' || last.content._tag !== 'Text')
        throw new Error('expected text blocks')
      const text = first.content.text
      expect(text.startsWith(FIXTURE.taskContext)).toBe(true)
      expect(text.indexOf(FIXTURE.taskDescription)).toBeGreaterThan(0)
      expect(text.indexOf('<stack/>')).toBeGreaterThan(
        text.indexOf(FIXTURE.taskDescription),
      )
      expect(text.endsWith(FIXTURE.conversationStart)).toBe(true)
      expect(last.content.text).toBe(
        `${FIXTURE.conversationEnd}\n${FIXTURE.immediateTask}`,
      )
    })

    it('fails with a clear error before the contract is served', async () => {
      const result = await build({})
      expect(Eff.Either.isLeft(result)).toBe(true)
      if (Eff.Either.isRight(result)) return
      expect(result.left).toBeInstanceOf(LLM.LLMError)
      expect(result.left.message).toBe(PromptContract.UNAVAILABLE)
    })
  })
})

describe('the served text', () => {
  it("names catalog_preview's size limit as the executor enforces it", () => {
    const limit = `${THRESHOLD / 1024} KiB`
    expect(FIXTURE.readingGuidance).toContain(limit)
    expect(
      FIXTURE.tools.find((t) => t.name === 'catalog_preview')!.description,
    ).toContain(limit)
  })
})

describe('a tool whose schema is served', () => {
  it('drops a property its decoder does not know instead of failing', async () => {
    let seen: unknown
    const tool = Tool.make(
      PreviewSchema,
      (input) => {
        seen = input
        return Eff.Effect.succeed(Eff.Option.none())
      },
      'read',
      'ignore',
    )
    // What a model following a newer served schema would send.
    const input: unknown = { s3_uri: 's3://b/k', pages: 3 }
    await Eff.Effect.runPromise(tool.executor(input as { s3_uri: string }))
    expect(seen).toEqual({ s3_uri: 's3://b/k' })
  })
})
