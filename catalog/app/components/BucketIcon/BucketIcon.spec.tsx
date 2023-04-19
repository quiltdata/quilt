import * as React from 'react'
import renderer from 'react-test-renderer'

import BucketIcon from './'

describe('components/BucketIcon', () => {
  it('should render default when no src', () => {
    const tree = renderer.create(<BucketIcon alt="No src" src="" />).toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('should render custom src', () => {
    const tree = renderer
      .create(<BucketIcon alt="Custom src" src="https://custom-src" />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
  describe('class names', () => {
    const className = 'A'
    const classes = {
      custom: 'C',
      stub: 'S',
    }
    it('should apply className', () => {
      const tree = renderer
        .create(
          <BucketIcon
            alt="Set className"
            className={className}
            src="https://custom-src"
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
    it('should apply `` className if src is set', () => {
      const tree = renderer
        .create(
          <BucketIcon
            alt="Custom className"
            className={className}
            classes={classes}
            src="https://custom-src"
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
    it('should apply `stub` className if no src', () => {
      const tree = renderer
        .create(
          <BucketIcon
            alt="Stub className"
            className={className}
            classes={classes}
            src=""
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
  })
})
