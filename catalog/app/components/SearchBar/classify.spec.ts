import { describe, expect, it } from 'vitest'

import { classifyQuery } from './classify'

describe('components/SearchBar/classify', () => {
  it('classifies a short keyword query as Search', () => {
    expect(classifyQuery('drugbank')).toBe('Search')
    expect(classifyQuery('rna seq')).toBe('Search')
  })

  it('classifies trailing-question-mark queries as Qurator', () => {
    expect(classifyQuery('drugbank?')).toBe('Qurator')
  })

  it('classifies wh-word / verb-of-inquiry leading queries as Qurator', () => {
    expect(classifyQuery('what is in this bucket')).toBe('Qurator')
    expect(classifyQuery('find packages with assays')).toBe('Qurator')
    expect(classifyQuery('summarize ccle')).toBe('Qurator')
  })

  it('classifies long (>= 5 word) queries as Qurator', () => {
    expect(classifyQuery('packages tagged with lc ms data')).toBe('Qurator')
  })

  it('always returns Search when Qurator is disabled', () => {
    expect(classifyQuery('what is in this bucket', false)).toBe('Search')
    expect(classifyQuery('drugbank?', false)).toBe('Search')
  })

  it('returns Search for an empty query', () => {
    expect(classifyQuery('   ')).toBe('Search')
  })
})
