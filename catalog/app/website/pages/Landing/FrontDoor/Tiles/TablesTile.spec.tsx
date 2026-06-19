import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import TablesTile from './TablesTile'

describe('website/pages/Landing/FrontDoor/Tiles/TablesTile', () => {
  afterEach(cleanup)

  it('renders the empty-state without error', () => {
    const { getByText } = render(<TablesTile />)
    expect(getByText('Tables')).toBeTruthy()
    expect(getByText('Tables coming soon')).toBeTruthy()
  })
})
