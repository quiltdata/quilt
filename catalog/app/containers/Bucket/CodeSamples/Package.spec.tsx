import * as React from 'react'
import renderer from 'react-test-renderer'

import PackageCodeSamples from './Package'

jest.mock(
  './Code',
  () =>
    ({
      children: { label, contents },
    }: {
      children: { label: string; contents: string }
    }) => (
      <dl key={label}>
        <dt>{label}:</dt> <dd>{contents}</dd>
      </dl>
    ),
)

describe('containers/Bucket/CodeSamples/Package', () => {
  it('renders catalog property', () => {
    const props = {
      bucket: 'bucket',
      name: 'name',
      hash: 'hash',
      hashOrTag: 'tag',
      path: 'path',
      catalog: 'catalog',
    }
    const tree = renderer.create(<PackageCodeSamples {...props} />).toJSON()
    expect(tree).toMatchSnapshot()
  })
})
