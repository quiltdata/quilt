import * as React from 'react'
import renderer from 'react-test-renderer'

import Dropzone from './Dropzone'

describe('Dropzone', () => {
  it('should render', () => {
    const tree = renderer.create(<Dropzone files={[]} />).toJSON()
    expect(tree).toMatchSnapshot()
  })
})
