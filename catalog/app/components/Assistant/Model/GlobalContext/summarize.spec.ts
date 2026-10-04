import * as Eff from 'effect'
import { describe, expect, it, vi } from 'vitest'

import * as Content from '../Content'
import * as LLM from '../LLM'
import * as Tool from '../Tool'

import { S3 } from './preview'
import { CHUNK_BYTES, DOC_MAX_BYTES, MAX_CHUNKS, summarize } from './summarize'

vi.mock('constants/config', () => ({ default: {} }))

const enc = new TextEncoder()
const dec = new TextDecoder()

function stubS3(size: number, body: Uint8Array = new Uint8Array(size)) {
  const ranges: (string | undefined)[] = []
  const layer = Eff.Layer.succeed(S3, {
    headObject: () => Eff.Effect.succeed({ ContentLength: size }),
    getObject: (_handle, range) => {
      ranges.push(range)
      if (!range) return Eff.Effect.succeed({ Body: body })
      const [start, end] = range.replace('bytes=', '').split('-').map(Number)
      return Eff.Effect.succeed({ Body: body.slice(start, end + 1) })
    },
  })
  return { layer, ranges }
}

function stubLLM(
  reply: (prompt: LLM.Prompt, n: number) => Eff.Effect.Effect<string, LLM.LLMError>,
  stopReason = 'end_turn',
) {
  const prompts: LLM.Prompt[] = []
  const layer = Eff.Layer.succeed(LLM.LLM, {
    converse: (prompt) => {
      prompts.push(prompt)
      return reply(prompt, prompts.length).pipe(
        Eff.Effect.map((text) => ({
          content: Eff.Option.some([Content.ResponseMessageContentBlock.Text({ text })]),
          backendResponse: { stopReason } as never,
        })),
      )
    },
  })
  return { layer, prompts }
}

const run = (key: string, s3: Eff.Layer.Layer<S3>, llm: Eff.Layer.Layer<LLM.LLM>) =>
  Eff.Effect.runPromise(
    summarize({ bucket: 'b', key }).pipe(Eff.Effect.provide(s3), Eff.Effect.provide(llm)),
  )

const resultText = (r: Tool.Result) =>
  r.content.map((c) => (c._tag === 'Text' ? c.text : '')).join('\n')

const docText = (p: LLM.Prompt) => {
  const doc = p.messages.find((m) => m.content._tag === 'Document')!.content
  return dec.decode((doc as Content.DocumentBlock).source as Uint8Array)
}

describe('components/Assistant/Model/GlobalContext/summarize', () => {
  it('summarizes a small PDF in one pass with a document block', async () => {
    const s3 = stubS3(763_705)
    const llm = stubLLM(() => Eff.Effect.succeed('A paper about cells.'))
    const r = await run('paper.pdf', s3.layer, llm.layer)
    expect(r.status).toBe('success')
    expect(s3.ranges).toEqual([undefined])
    expect(llm.prompts).toHaveLength(1)
    expect(llm.prompts[0].messages[0].content).toMatchObject({
      _tag: 'Document',
      format: 'pdf',
    })
    expect(llm.prompts[0].system).toMatch(/not instructions/)
    expect(resultText(r)).toContain("Read all of the document's text (745.8 KiB)")
    expect(resultText(r)).toContain(
      '<document-summary>\nA paper about cells.\n</document-summary>',
    )
  })

  it('refuses a PDF over the limit without reading it', async () => {
    const s3 = stubS3(DOC_MAX_BYTES + 1)
    const llm = stubLLM(() => Eff.Effect.succeed('never'))
    const r = await run('big.pdf', s3.layer, llm.layer)
    expect(r.status).toBe('error')
    expect(s3.ranges).toEqual([])
    expect(llm.prompts).toHaveLength(0)
    expect(resultText(r)).toMatch(/4\.0 MiB[^]*up to 4\.0 MiB/)
  })

  it('map-reduces a multi-chunk CSV, carrying the header into every part', async () => {
    const header = 'id,name\n'
    const row = 'x'.repeat(99) + '\n'
    const rows = Math.ceil((CHUNK_BYTES * 2.5) / row.length)
    const csv = enc.encode(header + row.repeat(rows))
    const s3 = stubS3(csv.length, csv)
    const llm = stubLLM((_p, n) => Eff.Effect.succeed(`summary ${n}`))
    const r = await run('data.csv', s3.layer, llm.layer)
    expect(r.status).toBe('success')
    expect(s3.ranges).toHaveLength(3)
    // 3 map calls + 1 reduce
    expect(llm.prompts).toHaveLength(4)
    const parts = llm.prompts.slice(0, 3).map(docText)
    for (const text of parts) {
      expect(text.startsWith(header)).toBe(true)
      expect(text.startsWith(header + header)).toBe(false)
      expect(text.endsWith('\n')).toBe(true)
    }
    // Lossless: the parts minus the carried header rebuild the file exactly.
    expect(
      parts[0] +
        parts
          .slice(1)
          .map((t) => t.slice(header.length))
          .join(''),
    ).toBe(dec.decode(csv))
    const reduce = llm.prompts[3].messages.map(
      (m) => (m.content as Content.TextBlock).text,
    )
    expect(reduce[0]).toContain('<part-summary index="3">\nsummary 3\n</part-summary>')
    expect(resultText(r)).toContain('Read the whole document')
    expect(resultText(r)).toContain('<document-summary>\nsummary 4\n</document-summary>')
  })

  it('stops at MAX_CHUNKS and says the rest was not read', async () => {
    const line = 'y'.repeat(1023) + '\n'
    const txt = enc.encode(line.repeat((CHUNK_BYTES / 1024) * (MAX_CHUNKS + 2)))
    const s3 = stubS3(txt.length, txt)
    const llm = stubLLM(() => Eff.Effect.succeed('s'))
    const r = await run('notes.txt', s3.layer, llm.layer)
    expect(r.status).toBe('success')
    expect(s3.ranges).toHaveLength(MAX_CHUNKS)
    expect(llm.prompts).toHaveLength(MAX_CHUNKS + 1)
    expect(resultText(r)).toContain(
      `Read the first 2.0 MiB of 2.5 MiB (${MAX_CHUNKS} of about ${MAX_CHUNKS + 2} parts); the rest was not read.`,
    )
  })

  it('fails honestly when the model says the input is too long', async () => {
    const s3 = stubS3(1024)
    const llm = stubLLM(() =>
      Eff.Effect.fail(
        new LLM.LLMError({
          message: 'Inference error (HTTP 400): Input is too long for requested model.',
        }),
      ),
    )
    const r = await run('report.docx', s3.layer, llm.layer)
    expect(r.status).toBe('error')
    expect(resultText(r)).toMatch(/too long for the model to summarize; no summary/)
    expect(resultText(r)).not.toContain('<document-summary>')
  })

  it('reads nothing for an empty document or an unsupported type', async () => {
    const llm = stubLLM(() => Eff.Effect.succeed('never'))
    const empty = stubS3(0)
    const r = await run('empty.pdf', empty.layer, llm.layer)
    expect(r.status).toBe('success')
    expect(resultText(r)).toContain('The document is empty')
    const other = stubS3(1024)
    const r2 = await run('table.parquet', other.layer, llm.layer)
    expect(r2.status).toBe('error')
    expect(resultText(r2)).toContain('handles only PDF')
    expect(empty.ranges.concat(other.ranges)).toEqual([])
    expect(llm.prompts).toHaveLength(0)
  })

  it('fails without a summary when a range read fails', async () => {
    const llm = stubLLM(() => Eff.Effect.succeed('never'))
    const s3 = Eff.Layer.succeed(S3, {
      headObject: () => Eff.Effect.succeed({ ContentLength: 1024 }),
      getObject: () => Eff.Effect.fail(new Error('AccessDenied') as never),
    })
    const r = await run('notes.txt', s3, llm.layer)
    expect(r.status).toBe('error')
    expect(resultText(r)).toContain('AccessDenied')
    expect(llm.prompts).toHaveLength(0)
  })

  it('keeps multi-byte characters whole across a chunk with no newline', async () => {
    // One line of 3-byte characters, so CHUNK_BYTES cuts inside a character.
    const txt = enc.encode('é€'.repeat(Math.ceil(CHUNK_BYTES / 5) + 10))
    const s3 = stubS3(txt.length, txt)
    const llm = stubLLM(() => Eff.Effect.succeed('s'))
    const r = await run('one-line.txt', s3.layer, llm.layer)
    expect(r.status).toBe('success')
    const parts = llm.prompts.slice(0, -1).map(docText)
    expect(parts.join('')).toBe(dec.decode(txt))
    expect(parts.join('')).not.toContain('\uFFFD')
  })

  it('marks a summary cut off at the token limit', async () => {
    const s3 = stubS3(1024)
    const llm = stubLLM(() => Eff.Effect.succeed('Half a sum'), 'max_tokens')
    const r = await run('report.docx', s3.layer, llm.layer)
    expect(r.status).toBe('success')
    expect(resultText(r)).toContain('(summary cut off at the length limit)')
  })
})
