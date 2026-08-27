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

    // The facets arrive in the aggregation's own order -- roughly the order the
    // fields were first seen while scanning documents -- so these fixtures are
    // deliberately scrambled rather than pre-sorted.
    const facet = (
      path: string,
      __typename: model.PackageUserMetaFacet['__typename'] = 'KeywordPackageUserMetaFacet',
    ): model.PackageUserMetaFacet => ({ __typename, path, sortable: true })

    const keys = (tree: model.FacetTree) => Array.from(tree.children.keys())

    describe('ordering', () => {
      it('sorts top-level keys by name, whatever order they arrived in', () => {
        const [grouped] = model.groupFacets(
          [
            facet('/source'),
            facet('/kind'),
            facet('/title'),
            facet('/createdAt'),
            facet('/group_title'),
          ],
          undefined,
          { by: 'name', direction: 'asc' },
        )
        expect(keys(grouped)).toEqual([
          'path:createdAt',
          'path:group_title',
          'path:kind',
          'path:source',
          'path:title',
        ])
      })

      it('defaults to ordering by name', () => {
        const facets = [facet('/zeta'), facet('/alpha')]
        expect(keys(model.groupFacets(facets)[0])).toEqual(
          keys(model.groupFacets(facets, undefined, { by: 'name', direction: 'asc' })[0]),
        )
      })

      it('sorts nested levels too, not just the top', () => {
        const [grouped] = model.groupFacets(
          [facet('/outer/zebra'), facet('/outer/apple'), facet('/outer/mango')],
          undefined,
          { by: 'name', direction: 'asc' },
        )
        const outer = grouped.children.get('path:outer')
        expect(outer?._tag).toBe('Tree')
        expect(keys(outer as model.FacetTree)).toEqual([
          'path:apple',
          'path:mango',
          'path:zebra',
        ])
      })

      // Reads each leaf's own `__typename`, not the tree key. A flat scalar field's
      // key is `path:<name>` with no type in it, so a key-based comparison made
      // "by type" identical to "by name" on the common case -- a package whose
      // metadata is all top-level scalars -- i.e. a control that changed nothing.
      it('groups by the leaf data type, then by name inside each type', () => {
        const [grouped] = model.groupFacets(
          [
            facet('/zeta_text', 'TextPackageUserMetaFacet'),
            facet('/beta_keyword', 'KeywordPackageUserMetaFacet'),
            facet('/alpha_text', 'TextPackageUserMetaFacet'),
            facet('/gamma_date', 'DatetimePackageUserMetaFacet'),
            facet('/delta_keyword', 'KeywordPackageUserMetaFacet'),
          ],
          undefined,
          { by: 'type', direction: 'asc' },
        )
        expect(keys(grouped)).toEqual([
          // keyword (pickable value list) first, alphabetical within
          'path:beta_keyword',
          'path:delta_keyword',
          // then date
          'path:gamma_date',
          // then free text, which can only be matched
          'path:alpha_text',
          'path:zeta_text',
        ])
      })

      it('sorts a subtree after every leaf, since it is not one type', () => {
        const [grouped] = model.groupFacets(
          [facet('/aaa_nested/inner'), facet('/zzz_leaf', 'TextPackageUserMetaFacet')],
          undefined,
          { by: 'type', direction: 'asc' },
        )
        expect(keys(grouped)).toEqual(['path:zzz_leaf', 'path:aaa_nested'])
      })

      it('actually reorders the promoted set, not just the tail', () => {
        // The two orderings must disagree about which filters get promoted, or the
        // switcher offers a choice that changes nothing a reader would notice.
        const facets = [
          facet('/aaa', 'TextPackageUserMetaFacet'),
          facet('/bbb', 'TextPackageUserMetaFacet'),
          facet('/zzz', 'KeywordPackageUserMetaFacet'),
        ]
        expect(
          keys(model.groupFacets(facets, 1, { by: 'name', direction: 'asc' })[0]),
        ).toEqual(['path:aaa'])
        expect(
          keys(model.groupFacets(facets, 1, { by: 'type', direction: 'asc' })[0]),
        ).toEqual(['path:zzz'])
      })

      // The load-bearing consequence: `groupFacets` promotes the first `visible`
      // children, so without a sort the promoted filters are whichever ones the
      // index happened to see first.
      it('decides the visible/hidden split by the chosen order', () => {
        const facets = [
          facet('/zulu'),
          facet('/yankee'),
          facet('/alpha'),
          facet('/bravo'),
        ]
        const [visible, hidden] = model.groupFacets(facets, 2, {
          by: 'name',
          direction: 'asc',
        })
        expect(keys(visible)).toEqual(['path:alpha', 'path:bravo'])
        expect(keys(hidden)).toEqual(['path:yankee', 'path:zulu'])
      })

      it('sorts numeric segments the way a reader reads them', () => {
        const [grouped] = model.groupFacets(
          [facet('/plate_10'), facet('/plate_2')],
          undefined,
          { by: 'name', direction: 'asc' },
        )
        expect(keys(grouped)).toEqual(['path:plate_2', 'path:plate_10'])
      })

      it('reverses the names for a descending name order', () => {
        const facets = [facet('/alpha'), facet('/charlie'), facet('/bravo')]
        expect(
          keys(
            model.groupFacets(facets, undefined, { by: 'name', direction: 'desc' })[0],
          ),
        ).toEqual(['path:charlie', 'path:bravo', 'path:alpha'])
      })

      it('reverses names inside a type bucket without reordering the buckets', () => {
        // "Type: Z → A" means the names run backwards *within* a type, not that free
        // text now outranks a keyword -- reversing the buckets too would make one
        // control read as two unrelated axes.
        const [grouped] = model.groupFacets(
          [
            facet('/a_keyword', 'KeywordPackageUserMetaFacet'),
            facet('/z_keyword', 'KeywordPackageUserMetaFacet'),
            facet('/a_text', 'TextPackageUserMetaFacet'),
            facet('/z_text', 'TextPackageUserMetaFacet'),
          ],
          undefined,
          { by: 'type', direction: 'desc' },
        )
        expect(keys(grouped)).toEqual([
          // keyword still leads text
          'path:z_keyword',
          'path:a_keyword',
          'path:z_text',
          'path:a_text',
        ])
      })

      it('sorts descending at nested levels too', () => {
        const [grouped] = model.groupFacets(
          [facet('/outer/apple'), facet('/outer/zebra'), facet('/outer/mango')],
          undefined,
          { by: 'name', direction: 'desc' },
        )
        expect(keys(grouped.children.get('path:outer') as model.FacetTree)).toEqual([
          'path:zebra',
          'path:mango',
          'path:apple',
        ])
      })

      it('offers every combination of the two axes, exactly once', () => {
        const combinations = model.FACET_ORDER_BY.flatMap((by) =>
          model.FACET_ORDER_DIRECTIONS.map((direction) => `${by}:${direction}`),
        )
        const offered = model.FACET_ORDERINGS.map((o) =>
          model.serializeFacetOrdering(o.ordering),
        )
        expect(offered.slice().sort()).toEqual(combinations.slice().sort())
        expect(new Set(offered).size).toBe(offered.length)
      })

      it('names every option, and the default is one of them', () => {
        model.FACET_ORDERINGS.forEach((o) => expect(o.label).toBeTruthy())
        expect(model.FACET_ORDERINGS.map((o) => o.label)).toEqual([
          'Name A → Z',
          'Name Z → A',
          'Type A → Z',
          'Type Z → A',
        ])
        expect(
          model.FACET_ORDERINGS.map((o) => model.serializeFacetOrdering(o.ordering)),
        ).toContain(model.serializeFacetOrdering(model.DEFAULT_FACET_ORDERING))
      })
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

    it('round-trips the metadata panel ordering as `mo`', () => {
      const params = model.serializeSearchUrlState({
        ...model.parseSearchParams('q=x'),
        facetOrdering: { by: 'type', direction: 'desc' },
      })
      expect(params.get('mo')).toBe('type:desc')
      expect(model.parseSearchParams(`q=x&${params.toString()}`).facetOrdering).toEqual({
        by: 'type',
        direction: 'desc',
      })
    })

    it('omits `mo` at the default, so a plain search URL stays clean', () => {
      const params = model.serializeSearchUrlState(model.parseSearchParams('q=x'))
      expect(params.get('mo')).toBeNull()
      expect(model.parseSearchParams('q=x').facetOrdering).toEqual(
        model.DEFAULT_FACET_ORDERING,
      )
    })

    // A hand-edited or stale link is untrusted input, and a panel's display
    // preference is never worth failing a search over.
    it('falls back per axis on a malformed `mo`', () => {
      expect(model.parseSearchParams('q=x&mo=type:sideways').facetOrdering).toEqual({
        by: 'type',
        direction: model.DEFAULT_FACET_ORDERING.direction,
      })
      expect(model.parseSearchParams('q=x&mo=nonsense:desc').facetOrdering).toEqual({
        by: model.DEFAULT_FACET_ORDERING.by,
        direction: 'desc',
      })
      expect(model.parseSearchParams('q=x&mo=').facetOrdering).toEqual(
        model.DEFAULT_FACET_ORDERING,
      )
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
