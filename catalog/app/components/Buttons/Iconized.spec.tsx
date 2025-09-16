// TODO: test matching media queries
// import mediaQuery from 'css-mediaquery'
import * as React from 'react'
import renderer from 'react-test-renderer'
import { Add as IconAdd } from '@material-ui/icons'

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
  it('render with SvgIcon component', () => {
    const tree = renderer
      .create(<Buttons.Iconized icon={IconAdd} label="Add Item" />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
