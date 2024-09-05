import * as KTree from 'utils/KeyedTree'

import * as model from './model'

jest.mock(
  'constants/config',
  jest.fn(() => ({
    registryUrl: '',
  })),
)

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
})
