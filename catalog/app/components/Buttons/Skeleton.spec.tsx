import * as React from 'react'
import renderer from 'react-test-renderer'

import * as Buttons from './'

describe('components/Buttons/Skeleton', () => {
  it('render medium by default', () => {
    const tree = renderer.create(<Buttons.Skeleton />).toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('render small', () => {
    const tree = renderer.create(<Buttons.Skeleton size="small" />).toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('render large', () => {
    const tree = renderer.create(<Buttons.Skeleton size="large" />).toJSON()
    expect(tree).toMatchSnapshot()
  })
})
