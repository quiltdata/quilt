import * as KTree from 'utils/KeyedTree'

import * as model from './model'

describe('containers/Search/model', () => {
  describe('groupFacets', () => {
    it('should group the facets without exceeding recursion limit', () => {
      const f1: model.PackageUserMetaFacet = {
        __typename: 'KeywordPackageUserMetaFacet',
        path: '/a/b',
        extents: {
          __typename: 'KeywordExtents',
          values: ['first'],
        },
      }
      const f2: model.PackageUserMetaFacet = {
        __typename: 'KeywordPackageUserMetaFacet',
        path: '/a/b',
        extents: {
          __typename: 'KeywordExtents',
          values: ['second'],
        },
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
})