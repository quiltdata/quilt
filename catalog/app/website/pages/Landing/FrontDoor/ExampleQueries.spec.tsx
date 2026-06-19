import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ExampleQueries from './ExampleQueries'

describe('website/pages/Landing/FrontDoor/ExampleQueries', () => {
  afterEach(cleanup)

  it('renders example chips without error', () => {
    const { getByText } = render(<ExampleQueries onSelect={vi.fn()} />)
    expect(getByText('drugbank')).toBeTruthy()
  })

  it('prefills the bar via onSelect when a chip is clicked', () => {
    const onSelect = vi.fn()
    const { getByText } = render(<ExampleQueries onSelect={onSelect} />)
    fireEvent.click(getByText('drugbank'))
    expect(onSelect).toHaveBeenCalledWith('drugbank')
  })
})
