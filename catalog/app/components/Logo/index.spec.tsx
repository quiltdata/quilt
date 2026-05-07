import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleToS3Url } from 'utils/s3paths'

import Logo from '.'

vi.mock('utils/AWS', () => ({
  Signer: {
    useS3Signer: () => handleToS3Url,
  },
}))

const captureException = vi.fn()
vi.mock('@sentry/react', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}))

describe('components/Logo', () => {
  beforeEach(() => {
    captureException.mockClear()
  })

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

  it('should render signed S3 logo', () => {
    const { container } = render(
      <Logo src="s3://bucket/logo.png" height="10px" width="10px" />,
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('custom')
    expect(element.getAttribute('src')).toBe('s3://bucket/logo.png')
    expect(captureException).not.toHaveBeenCalled()
  })

  it('should fall back to default logo and report on malformed S3 URL', () => {
    const { container } = render(<Logo src="s3://" height="10px" width="10px" />)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('quilt')
    expect(element.className).not.toContain('custom')
    expect(captureException).toHaveBeenCalledTimes(1)
    const [err, ctx] = captureException.mock.calls[0]
    expect(err).toBeInstanceOf(Error)
    expect(ctx).toEqual({ extra: { src: 's3://' } })
  })
})
