import * as React from 'react'
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'

import BucketIcon from './'

const darkTheme = createMuiTheme({ palette: { type: 'dark' } })

describe('components/BucketIcon', () => {
  afterEach(cleanup)

  it('should render the inline stub when no src', () => {
    const { container } = render(<BucketIcon alt="No src" src="" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('should mark the stub with the contrast class when the theme is dark', () => {
    const { container } = render(
      <MuiThemeProvider theme={darkTheme}>
        <BucketIcon alt="Contrast" src="" />
      </MuiThemeProvider>,
    )
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('contrast')
  })

  it('should not mark the stub with the contrast class in a light theme', () => {
    const { container } = render(<BucketIcon alt="Plain" src="" />)
    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain(
      'contrast',
    )
  })

  it('should render custom icons as decorative when no alt', () => {
    const { container } = render(<BucketIcon src="https://custom-src" />)
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('')
  })

  it('should render custom src as an image', () => {
    const { getByAltText } = render(
      <BucketIcon alt="Custom src" src="https://custom-src" />,
    )
    expect(getByAltText('Custom src').getAttribute('src')).toBe('https://custom-src')
  })

  it('should expose the title on the stub', () => {
    const { getByTitle } = render(<BucketIcon alt="" src="" title="Default icon" />)
    expect(getByTitle('Default icon').closest('svg')).not.toBeNull()
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
      const { container } = render(
        <BucketIcon
          alt="Stub className"
          className={className}
          classes={classes}
          src=""
        />,
      )
      const svgClassName = container.querySelector('svg')?.getAttribute('class')
      expect(svgClassName).toContain('STUB')
      expect(svgClassName).toContain('PRIMARY')
      expect(svgClassName).not.toContain('CUSTOM')
    })
  })
})
