import * as React from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('./bucket.svg', () => ({ default: 'IMAGE_MOCK' }))

import BucketIcon from './'

describe('components/BucketIcon', () => {
  it('should render default when no src', () => {
    const { container } = render(<BucketIcon alt="No src" src="" />)
    expect(container.firstChild).toMatchSnapshot()
  })
  it('should render custom src', () => {
    const { container } = render(<BucketIcon alt="Custom src" src="https://custom-src" />)
    expect(container.firstChild).toMatchSnapshot()
  })
  describe('class names', () => {
    const className = 'A'
    const classes = {
      custom: 'C',
      stub: 'S',
    }
    it('should apply className', () => {
      const { container } = render(
        <BucketIcon alt="Set className" className={className} src="https://custom-src" />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })
    it('should apply `` className if src is set', () => {
      const { container } = render(
        <BucketIcon
          alt="Custom className"
          className={className}
          classes={classes}
          src="https://custom-src"
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })
    it('should apply `stub` className if no src', () => {
      const { container } = render(
        <BucketIcon
          alt="Stub className"
          className={className}
          classes={classes}
          src=""
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })
  })
})
