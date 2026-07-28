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
      }
      const f2: model.PackageUserMetaFacet = {
        __typename: 'KeywordPackageUserMetaFacet',
        path: '/a/b',
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

  describe('parseSort / serializeSort', () => {
    const PRESET: model.PackageSort = {
      preset: model.ResultOrder.NEWEST,
      field: null,
      direction: null,
    }
    const SYSTEM_DESC: model.PackageSort = {
      preset: null,
      field: { system: model.PackageSystemField.MODIFIED, userMeta: null },
      direction: model.SortDirection.DESC,
    }
    const META_ASC: model.PackageSort = {
      preset: null,
      field: { system: null, userMeta: '/cell_count' },
      direction: model.SortDirection.ASC,
    }

    describe('parseSort', () => {
      it('returns null for null/empty/garbage input', () => {
        expect(model.parseSort(null)).toBeNull()
        expect(model.parseSort('')).toBeNull()
        expect(model.parseSort('nonsense')).toBeNull()
      })

      it('parses a bare preset', () => {
        expect(model.parseSort('NEWEST')).toEqual(PRESET)
      })

      it('parses a directioned system field', () => {
        expect(model.parseSort('-MODIFIED')).toEqual(SYSTEM_DESC)
      })

      it('parses a directioned user-meta pointer', () => {
        expect(model.parseSort('+meta:/cell_count')).toEqual(META_ASC)
      })

      it('rejects a field without a direction prefix', () => {
        expect(model.parseSort('MODIFIED')).toBeNull()
      })

      it('rejects an unknown system field', () => {
        expect(model.parseSort('-NOPE')).toBeNull()
      })

      it('rejects an empty meta pointer', () => {
        expect(model.parseSort('+meta:')).toBeNull()
      })
    })

    describe('serializeSort', () => {
      it('returns null for null', () => {
        expect(model.serializeSort(null)).toBeNull()
      })

      it('serializes a preset', () => {
        expect(model.serializeSort(PRESET)).toBe('NEWEST')
      })

      it('serializes a system field with direction', () => {
        expect(model.serializeSort(SYSTEM_DESC)).toBe('-MODIFIED')
      })

      it('serializes a user-meta pointer with direction', () => {
        expect(model.serializeSort(META_ASC)).toBe('+meta:/cell_count')
      })
    })

    describe('round-trip', () => {
      it.each([PRESET, SYSTEM_DESC, META_ASC])(
        'parse(serialize(x)) === x for %o',
        (sort) => {
          expect(model.parseSort(model.serializeSort(sort))).toEqual(sort)
        },
      )
    })
  })
})
