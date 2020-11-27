import * as React from 'react'
import renderer from 'react-test-renderer'

import Header from './Header'

describe('Header', () => {
  it('should render', () => {
    const tree = renderer.create(<Header />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should change color on error', () => {
    const tree = renderer.create(<Header error />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should change color on warning', () => {
    const tree = renderer.create(<Header warning />).toJSON()
    expect(tree).toMatchSnapshot()
  })
})
