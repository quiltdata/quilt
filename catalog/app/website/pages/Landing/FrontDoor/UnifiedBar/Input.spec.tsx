import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Input from './Input'

describe('website/pages/Landing/FrontDoor/UnifiedBar/Input', () => {
  afterEach(cleanup)

  it('renders without error and shows the live route badge', () => {
    const { getByText } = render(
      <Input
        route="Qurator"
        showRouteBadge
        value="hello"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )
    expect(getByText('Qurator')).toBeTruthy()
  })

  it('hides the route badge when showRouteBadge is false', () => {
    const { queryByText } = render(
      <Input
        route="Search"
        showRouteBadge={false}
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )
    expect(queryByText('Search')).toBeNull()
  })

  it('submits on Enter', () => {
    const onSubmit = vi.fn()
    const { getByLabelText } = render(
      <Input
        route="Search"
        showRouteBadge
        value="drugbank"
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.keyDown(getByLabelText('Search or ask Qurator'), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
