import * as React from 'react'
import { render } from '@testing-library/react'
import * as Icons from '@material-ui/icons'
import { describe, it, expect } from 'vitest'

import * as Buttons from './'

describe('components/Buttons/Iconized', () => {
  it('render icon and label', () => {
    const { container } = render(<Buttons.Iconized icon="ac_unit" label="A" />)
    expect(container.firstChild).toMatchSnapshot()
  })
  it('render rotated', () => {
    const { container } = render(<Buttons.Iconized icon="ac_unit" label="A" rotate />)
    expect(container.firstChild).toMatchSnapshot()
  })
  it('render contained', () => {
    const { container } = render(
      <Buttons.Iconized icon="ac_unit" label="A" variant="contained" />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
  it('render with SvgIcon component', () => {
    const { container } = render(<Buttons.Iconized icon={Icons.Add} label="Add Item" />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
