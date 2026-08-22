import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import * as Icons from '@material-ui/icons'
import { describe, it, expect, afterEach } from 'vitest'

import * as Buttons from './'

describe('components/Buttons/Iconized', () => {
  afterEach(cleanup)

  it('render icon and label', () => {
    const { container, getByText } = render(
      <Buttons.Iconized icon="ac_unit" label="Click me" />,
    )
    const button = container.firstChild as HTMLElement
    expect(button.className).toContain('outlined')
    expect(getByText('Click me')).toBeTruthy()
    expect(getByText('ac_unit').className).not.toContain('rotated')
  })

  it('render rotated', () => {
    const { container, getByText } = render(
      <Buttons.Iconized icon="ac_unit" label="Click me" rotate />,
    )
    const button = container.firstChild as HTMLElement
    expect(button.className).toContain('outlined')
    expect(getByText('Click me')).toBeTruthy()
    expect(getByText('ac_unit').className).toContain('rotated')
  })

  it('render contained', () => {
    const { container, getByText } = render(
      <Buttons.Iconized icon="ac_unit" label="A" variant="contained" />,
    )
    const button = container.firstChild as HTMLElement
    expect(button.className).toContain('contained')
    expect(getByText('A')).toBeTruthy()
    expect(getByText('ac_unit')).toBeTruthy()
  })
  it('render with SvgIcon component', () => {
    const { container, getByText } = render(
      <Buttons.Iconized icon={Icons.Add} label="Add Item" />,
    )
    expect(getByText('Add Item')).toBeTruthy()
    expect(container.querySelector('path')?.getAttribute('d')).toBe(
      'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    )
  })
})
