import * as React from 'react'
import renderer from 'react-test-renderer'

import FilesStats from './FilesStats'

describe('FilesStats', () => {
  it('should render', () => {
    const tree = renderer.create(<FilesStats files={[]} />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  // FIXME: fix "jest + react-intl"
  it.skip('should render files total size', () => {
    const tree = renderer
      .create(<FilesStats files={[{ size: 100000 }, { size: 200000 }]} />)
      .toJSON()
    expect(tree).toMatchInlineSnapshot()
  })
})
