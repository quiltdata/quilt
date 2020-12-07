import * as React from 'react'
import renderer from 'react-test-renderer'

import Overlay from './Overlay'

describe('components/Dropzone/Overlay', () => {
  it('should render', () => {
    const tree = renderer.create(<Overlay />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should apply className', () => {
    const tree = renderer.create(<Overlay className="alteredStyles" />).toJSON()
    expect(tree).toMatchSnapshot()
  })
})
