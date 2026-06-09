import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

vi.mock('./bucket.svg', () => ({ default: 'IMAGE_MOCK' }))

import BucketIcon from './'

describe('components/BucketIcon', () => {
  afterEach(cleanup)

  it('should render default when no src', () => {
    const { getByAltText } = render(<BucketIcon alt="No src" src="" />)
    expect(getByAltText('No src').getAttribute('src')).toBe('IMAGE_MOCK')
  })

  it('should render custom src', () => {
    const { getByAltText } = render(
      <BucketIcon alt="Custom src" src="https://custom-src" />,
    )
    expect(getByAltText('Custom src').getAttribute('src')).toBe('https://custom-src')
  })

  describe('class names', () => {
    const className = 'PRIMARY'
    const classes = {
      custom: 'CUSTOM',
      stub: 'STUB',
    }

    it('should apply className', () => {
      const { getByAltText } = render(
        <BucketIcon alt="Set className" className={className} src="https://custom-src" />,
      )
      expect(getByAltText('Set className').className).toContain('PRIMARY')
    })

    it('should apply custom className if src is set', () => {
      const { getByAltText } = render(
        <BucketIcon
          alt="Custom className"
          className={className}
          classes={classes}
          src="https://custom-src"
        />,
      )
      const img = getByAltText('Custom className')
      expect(img.className).toContain('CUSTOM')
      expect(img.className).toContain('PRIMARY')
      expect(img.className).not.toContain('STUB')
    })

    it('should apply `stub` className if no src', () => {
      const { getByAltText } = render(
        <BucketIcon
          alt="Stub className"
          className={className}
          classes={classes}
          src=""
        />,
      )
      const img = getByAltText('Stub className')
      expect(img.className).toContain('STUB')
      expect(img.className).toContain('PRIMARY')
      expect(img.className).not.toContain('CUSTOM')
    })
  })
})
