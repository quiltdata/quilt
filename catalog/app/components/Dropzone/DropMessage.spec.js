import * as React from 'react'
import renderer from 'react-test-renderer'

import DropMessage from './DropMessage'

describe('DropMessage', () => {
  it('should render with default message', () => {
    const tree = renderer.create(<DropMessage />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should render error', () => {
    const tree = renderer
      .create(<DropMessage error="This is errror" warning="This is warning" />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should render warning', () => {
    const tree = renderer.create(<DropMessage warning="This is warning" />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should be empty when disabled', () => {
    const tree = renderer
      .create(<DropMessage disabled error="This is errror" warning="This is warning" />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
