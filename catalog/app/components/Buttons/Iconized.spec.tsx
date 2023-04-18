import * as React from 'react'
import renderer from 'react-test-renderer'

import * as Buttons from './'

describe('components/Buttons/Iconized', () => {
  it('render icon and label', () => {
    const tree = renderer.create(<Buttons.Iconized icon="ac_unit" label="A" />).toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('render rotated', () => {
    const tree = renderer
      .create(<Buttons.Iconized icon="ac_unit" label="A" rotate />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('render contained', () => {
    const tree = renderer
      .create(<Buttons.Iconized icon="ac_unit" label="A" variant="contained" />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
