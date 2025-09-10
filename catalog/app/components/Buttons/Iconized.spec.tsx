// TODO: test matching media queries
// import mediaQuery from 'css-mediaquery'
import * as React from 'react'
import { render } from '@testing-library/react'

import * as Buttons from './'

describe('components/Buttons/Iconized', () => {
  it('render icon and label', () => {
    const { container } = render(<Buttons.Iconized icon="ac_unit" label="A" />)
    expect(container).toMatchSnapshot()
  })
  it('render rotated', () => {
    const { container } = render(<Buttons.Iconized icon="ac_unit" label="A" rotate />)
    expect(container).toMatchSnapshot()
  })
  it('render contained', () => {
    const { container } = render(
      <Buttons.Iconized icon="ac_unit" label="A" variant="contained" />,
    )
    expect(container).toMatchSnapshot()
  })
})
