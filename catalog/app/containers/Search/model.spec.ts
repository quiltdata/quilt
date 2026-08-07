import { describe, expect, it, vi } from 'vitest'

import * as KTree from 'utils/KeyedTree'

import * as model from './model'

vi.mock('constants/config', () => ({
  registryUrl: '',
}))

describe('containers/Search/model', () => {
  describe('groupFacets', () => {
    it('should group the facets without exceeding recursion limit', () => {
      const f1: model.PackageUserMetaFacet = {
        __typename: 'KeywordPackageUserMetaFacet',
        path: '/a/b',
        sortable: true,
      }
      const f2: model.PackageUserMetaFacet = {
        __typename: 'KeywordPackageUserMetaFacet',
        path: '/a/b',
        sortable: true,
      }
      const facets = [f1, f2]
      const [grouped] = model.groupFacets(facets)
      expect(grouped).toEqual(
        KTree.Tree([
          KTree.Pair('path:a', KTree.Tree([KTree.Pair('path:b', KTree.Leaf(f1))])),
        ]),
      )
    })
  })

  describe('parseOrdering / serializeOrdering', () => {
    describe('parseOrdering (precedence: new-`s` → legacy-`s` → legacy-`o` → fallback)', () => {
      it('returns the fallback when neither param is set', () => {
        expect(model.parseOrdering(null, null, null)).toBeNull()
        expect(model.parseOrdering(null, null, 'sys:modified:desc')).toBe(
          'sys:modified:desc',
        )
      })

      it('passes a Wave-2 `s` expression through verbatim (highest precedence)', () => {
        expect(model.parseOrdering('sys:name:asc', 'NEWEST', null)).toBe('sys:name:asc')
        expect(
          model.parseOrdering('usr:/experiment/date:datetime:desc', null, null),
        ).toBe('usr:/experiment/date:datetime:desc')
      })

      it('decodes the explicit-relevance sentinel to null even against a non-null fallback', () => {
        expect(model.parseOrdering('relevance', null, 'sys:modified:desc')).toBeNull()
      })

      it('maps a legacy preset `s` form', () => {
        expect(model.parseOrdering('NEWEST', null, null)).toBe('sys:modified:desc')
        expect(model.parseOrdering('BEST_MATCH', null, null)).toBeNull()
      })

      it('maps a legacy directioned system-field `s` form', () => {
        expect(model.parseOrdering('-MODIFIED', null, null)).toBe('sys:modified:desc')
        expect(model.parseOrdering('+NAME', null, null)).toBe('sys:name:asc')
      })

      it('maps a legacy user-meta `s` pointer form to a keyword expression', () => {
        expect(model.parseOrdering('+meta:/cell_count', null, null)).toBe(
          'usr:/cell_count:keyword:asc',
        )
      })

      it('falls back to a legacy `o` preset only when `s` is absent/unrecognized', () => {
        expect(model.parseOrdering(null, 'OLDEST', null)).toBe('sys:modified:asc')
        // an unrecognized `s` does NOT block the `o` fallback
        expect(model.parseOrdering('garbage', 'LEX_ASC', null)).toBe('sys:name:asc')
      })

      it('returns the fallback for a fully unrecognized input', () => {
        expect(model.parseOrdering('garbage', 'garbage', 'sys:size:asc')).toBe(
          'sys:size:asc',
        )
      })
    })

    describe('serializeOrdering', () => {
      it('serializes an expression verbatim', () => {
        expect(model.serializeOrdering('sys:modified:desc')).toBe('sys:modified:desc')
      })

      it('serializes null (explicit relevance) to the sentinel', () => {
        expect(model.serializeOrdering(null)).toBe('relevance')
      })
    })

    describe('orderingToResultOrder (objects boundary, lossy)', () => {
      it('maps the presets to their enum', () => {
        expect(model.orderingToResultOrder(null)).toBe(model.GQLResultOrder.BEST_MATCH)
        expect(model.orderingToResultOrder('sys:modified:desc')).toBe(
          model.GQLResultOrder.NEWEST,
        )
        expect(model.orderingToResultOrder('sys:name:asc')).toBe(
          model.GQLResultOrder.LEX_ASC,
        )
      })

      it('falls back to BEST_MATCH for a non-preset (pointer) ordering', () => {
        expect(model.orderingToResultOrder('usr:/x:number:asc')).toBe(
          model.GQLResultOrder.BEST_MATCH,
        )
        expect(model.orderingToResultOrder('sys:size:asc')).toBe(
          model.GQLResultOrder.BEST_MATCH,
        )
      })
    })
  })
})
