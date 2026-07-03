import { describe, expect, it } from 'vitest'

import {
  compileFilter,
  defaultVisibleMeta,
  deriveMetaColumns,
  matchMeta,
} from './packagesMeta'
import type { MetaColumnSpec, MetaPredicateType } from './packagesMeta'

const spec = (
  pointer: string,
  count: number = 1,
  predicateType: MetaPredicateType = 'Text',
): MetaColumnSpec => ({
  pointer,
  title: pointer.replace(/^\//, ''),
  predicateType,
  count,
})

describe('containers/DataProduct/packagesMeta', () => {
  describe('deriveMetaColumns', () => {
    it('flattens nested records into leaf pointers with counts', () => {
      const { specs, total } = deriveMetaColumns([
        { a: 1, b: { c: 'x' } },
        { a: 2 },
        null,
        undefined,
        new Error('meta not parseable'),
      ])
      expect(total).toBe(2)
      expect(specs).toEqual([
        { pointer: '/a', title: 'a', predicateType: 'Number', count: 2 },
        { pointer: '/b/c', title: 'b/c', predicateType: 'Text', count: 1 },
      ])
    })

    it('treats arrays, empty objects and nulls as leaves', () => {
      const { specs } = deriveMetaColumns([{ tags: ['x'], empty: {}, none: null }])
      expect(specs.map((s) => s.pointer)).toEqual(['/empty', '/none', '/tags'])
    })

    it('infers Number/Boolean only for uniform kinds, ignoring nulls', () => {
      expect(deriveMetaColumns([{ v: 1 }, { v: 'x' }]).specs[0].predicateType).toBe(
        'Text',
      )
      expect(deriveMetaColumns([{ v: true }, { v: false }]).specs[0].predicateType).toBe(
        'Boolean',
      )
      expect(deriveMetaColumns([{ v: 1 }, { v: null }]).specs[0].predicateType).toBe(
        'Number',
      )
    })

    it('sorts by coverage desc, then pointer asc', () => {
      const { specs } = deriveMetaColumns([{ b: 1, a: 1 }, { b: 2 }])
      expect(specs.map((s) => s.pointer)).toEqual(['/b', '/a'])
    })
  })

  describe('defaultVisibleMeta', () => {
    it('keeps the leading majority paths, capped at three', () => {
      const mc = {
        total: 4,
        specs: [
          spec('/a', 4),
          spec('/b', 3),
          spec('/c', 3),
          spec('/d', 3),
          spec('/e', 2),
        ],
      }
      expect(defaultVisibleMeta(mc)).toEqual(new Set(['/a', '/b', '/c']))
    })

    it('is empty when nothing has majority coverage', () => {
      expect(defaultVisibleMeta({ total: 4, specs: [spec('/a', 2)] })).toEqual(new Set())
    })
  })

  describe('compileFilter', () => {
    const specs = [spec('/study/phase'), spec('/phase'), spec('/n')]

    it('splits free text and key:value terms', () => {
      expect(compileFilter('Foo phase:III', specs)).toEqual({
        nameTerms: ['foo'],
        metaTerms: [{ pointers: ['/study/phase', '/phase'], value: 'iii' }],
      })
    })

    it('resolves a key by full path', () => {
      expect(compileFilter('study/phase:iii', specs).metaTerms).toEqual([
        { pointers: ['/study/phase'], value: 'iii' },
      ])
    })

    it('splits at the first colon only', () => {
      expect(compileFilter('n:12:30', specs).metaTerms).toEqual([
        { pointers: ['/n'], value: '12:30' },
      ])
    })

    it('leaves unresolved keys with no pointers', () => {
      expect(compileFilter('nope:x', specs).metaTerms).toEqual([
        { pointers: [], value: 'x' },
      ])
    })
  })

  describe('matchMeta', () => {
    const meta = { study: { phase: 'Phase III' }, n: 42 }

    it('matches values case-insensitively by substring', () => {
      expect(matchMeta([{ pointers: ['/study/phase'], value: 'iii' }], meta)).toBe(true)
      expect(matchMeta([{ pointers: ['/study/phase'], value: 'iv' }], meta)).toBe(false)
    })

    it('treats an empty value as a presence check', () => {
      expect(matchMeta([{ pointers: ['/study/phase'], value: '' }], meta)).toBe(true)
      expect(matchMeta([{ pointers: ['/missing'], value: '' }], meta)).toBe(false)
    })

    it('stringifies non-string leaves', () => {
      expect(matchMeta([{ pointers: ['/n'], value: '42' }], meta)).toBe(true)
    })

    it('ANDs terms together', () => {
      const terms = [
        { pointers: ['/study/phase'], value: 'iii' },
        { pointers: ['/n'], value: '42' },
      ]
      expect(matchMeta(terms, meta)).toBe(true)
      expect(matchMeta([terms[0], { pointers: ['/n'], value: '43' }], meta)).toBe(false)
    })

    it('never matches through unresolved keys', () => {
      expect(matchMeta([{ pointers: [], value: 'x' }], meta)).toBe(false)
    })

    it('degrades: members without meta match only the empty term list', () => {
      expect(matchMeta([], null)).toBe(true)
      expect(matchMeta([{ pointers: ['/n'], value: '' }], null)).toBe(false)
      expect(matchMeta([{ pointers: ['/n'], value: '' }], new Error('bad'))).toBe(false)
    })
  })
})
