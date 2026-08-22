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

  // The URL is the contract catalog, registry and MCP share: a search link
  // pasted into chat, a bookmark, or an MCP-built URL must reconstruct the
  // exact state that produced it.
  describe('parseSearchParams / serializeSearchUrlState (URL round-trip)', () => {
    const roundTrip = (qs: string) =>
      model.serializeSearchUrlState(model.parseSearchParams(qs)).toString()

    it('round-trips the full meta-sort state: q, ordering (s), view, buckets', () => {
      const qs = 'q=drugbank&s=usr%3A%2Fstudy%2Fphase%3Akeyword%3Aasc&v=t&b=bkt-a%2Cbkt-b'
      const state = model.parseSearchParams(qs)
      expect(state.searchString).toBe('drugbank')
      expect(state.ordering).toBe('usr:/study/phase:keyword:asc')
      expect(state.view).toBe(model.View.Table)
      expect(state.buckets).toEqual(['bkt-a', 'bkt-b'])
      expect(state.resultType).toBe(model.ResultType.QuiltPackage)
      // parse(serialize(parse(qs))) is a fixed point
      expect(model.parseSearchParams(roundTrip(qs))).toEqual(state)
    })

    it('round-trips a system-field ordering', () => {
      const params = model.serializeSearchUrlState(
        model.parseSearchParams('q=x&s=sys:modified:desc'),
      )
      expect(params.get('s')).toBe('sys:modified:desc')
      expect(params.get('q')).toBe('x')
    })

    it('omits `s` when the ordering equals the mount default', () => {
      // DEFAULT_ORDERING is null (relevance): no explicit choice, no param.
      const params = model.serializeSearchUrlState(model.parseSearchParams('q=x'))
      expect(params.get('s')).toBeNull()
    })

    it('round-trips explicit relevance against a non-null default via the sentinel', () => {
      // With a non-null default ordering, choosing relevance IS a choice and
      // must survive the URL (otherwise the link re-applies the default).
      const defaults = { ordering: 'sys:modified:desc' }
      const params = model.serializeSearchUrlState(
        { ...model.parseSearchParams('q=x'), ordering: null },
        defaults,
      )
      expect(params.get('s')).toBe('relevance')
      expect(model.parseSearchParams(`q=x&${params.toString()}`, defaults).ordering).toBe(
        null,
      )
    })

    it('parses legacy `o` and legacy `s` forms but serializes the one vocabulary', () => {
      // Old links keep working; new links only ever carry Wave-2 expressions.
      const fromLegacyO = model.parseSearchParams('q=x&o=NEWEST')
      expect(fromLegacyO.ordering).toBe('sys:modified:desc')
      expect(model.serializeSearchUrlState(fromLegacyO).get('s')).toBe(
        'sys:modified:desc',
      )

      const fromLegacyS = model.parseSearchParams('q=x&s=-MODIFIED')
      expect(fromLegacyS.ordering).toBe('sys:modified:desc')
      expect(model.serializeSearchUrlState(fromLegacyS).get('s')).toBe(
        'sys:modified:desc',
      )
    })
  })
})
