import * as React from 'react'
import { render } from '@testing-library/react'

import * as Buttons from './'

describe('components/Buttons/Skeleton', () => {
  it('render medium by default', () => {
    const { container } = render(<Buttons.Skeleton />)
    expect(container).toMatchSnapshot()
  })
  it('render small', () => {
    const { container } = render(<Buttons.Skeleton size="small" />)
    expect(container).toMatchSnapshot()
  })
  it('render large', () => {
    const { container } = render(<Buttons.Skeleton size="large" />)
    expect(container).toMatchSnapshot()
  })
})
