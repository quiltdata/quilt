import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'

import * as Buttons from './'

describe('components/Buttons/Skeleton', () => {
  afterEach(cleanup)

  it('render medium by default', () => {
    const { container } = render(<Buttons.Skeleton />)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('medium')
    expect(element.className).not.toContain('large')
    expect(element.className).not.toContain('small')
  })
  it('render small', () => {
    const { container } = render(<Buttons.Skeleton size="small" />)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('small')
    expect(element.className).not.toContain('large')
    expect(element.className).not.toContain('medium')
  })
  it('render large', () => {
    const { container } = render(<Buttons.Skeleton size="large" />)
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain('large')
    expect(element.className).not.toContain('small')
    expect(element.className).not.toContain('medium')
  })
})
