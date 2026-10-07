import { describe, it, expect, vi } from 'vitest'

vi.mock('components/Assistant/Model/Assistant', () => ({ useLightLLMs: () => null }))
vi.mock('constants/config', () => ({ default: {} }))

import { buildPrompt, parseSuggestions } from './metaSuggest'

const schema = {
  type: 'object',
  required: ['project', 'assay'],
  properties: {
    project: { type: 'string', title: 'Project' },
    assay: { enum: ['RNA-seq', 'WGS'] },
    sample_count: { type: 'integer', minimum: 1 },
  },
}

describe('containers/Bucket/PackageDialog/State/metaSuggest', () => {
  describe('parseSuggestions', () => {
    it('keeps values that pass their field schema and drops the rest', () => {
      const text = `Here you go:
      {"project": {"value": "ONC-104", "reason": "same prefix as 5 packages"},
       "assay": {"value": "RNA"},
       "sample_count": {"value": 0},
       "unknown": {"value": "x"}}`
      expect(parseSuggestions(text, schema)).toEqual({
        project: { value: 'ONC-104', reason: 'same prefix as 5 packages' },
      })
    })

    it('returns nothing for a non-JSON answer', () => {
      expect(parseSuggestions('I cannot tell.', schema)).toEqual({})
      expect(parseSuggestions('{not json}', schema)).toEqual({})
    })

    it('skips empty values', () => {
      expect(parseSuggestions('{"project": {"value": ""}}', schema)).toEqual({})
    })
  })

  describe('buildPrompt', () => {
    it('carries fields, evidence and files, capped', () => {
      const files = Array.from({ length: 250 }, (_, i) => `reads/s${i}.fastq.gz`)
      const prompt = buildPrompt({
        examples: [{ name: 'onc/run-1', meta: { project: 'ONC-104' } }],
        files,
        name: 'onc/run-2',
        schema,
      })
      expect(prompt).toContain('"key":"assay"')
      expect(prompt).toContain('"enum":["RNA-seq","WGS"]')
      expect(prompt).toContain('{"name":"onc/run-1","meta":{"project":"ONC-104"}}')
      expect(prompt).toContain('<package-name>onc/run-2</package-name>')
      expect(prompt).toContain('<files count="250">')
      expect(prompt).toContain('reads/s199.fastq.gz')
      expect(prompt).not.toContain('reads/s200.fastq.gz')
    })
  })
})
