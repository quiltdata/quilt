import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { handleToS3Url } from 'utils/s3paths'

import Logo from '.'

vi.mock('utils/AWS', () => ({
  Signer: {
    useS3Signer: () => handleToS3Url,
  },
}))

describe('components/Logo', () => {
  it('should render squared logo', () => {
    const { container } = render(<Logo height="20px" width="20px" />)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('quilt')
    expect(element.className).not.toContain('custom')
  })

  it('should render rectangular logo', () => {
    const { container } = render(<Logo height="30px" width="60px" />)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('quilt')
    expect(element.className).not.toContain('custom')
  })

  it('should render custom logo', () => {
    const { container } = render(
      <Logo src="https://example.com/example.png" height="10px" width="10px" />,
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('custom')
    expect(element.className).not.toContain('quilt')
    expect(element.getAttribute('src')).toBe('https://example.com/example.png')
  })
})
