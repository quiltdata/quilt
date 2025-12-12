import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { makeStyles } from 'utils/makeStyles.spec'

import * as Buttons from './'

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  makeStyles: makeStyles('Skeleton'),
}))

describe('components/Buttons/Skeleton', () => {
  it('render medium by default', () => {
    const { container } = render(<Buttons.Skeleton />)
    expect(container.firstChild).toMatchSnapshot()
  })
  it('render small', () => {
    const { container } = render(<Buttons.Skeleton size="small" />)
    expect(container.firstChild).toMatchSnapshot()
  })
  it('render large', () => {
    const { container } = render(<Buttons.Skeleton size="large" />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
