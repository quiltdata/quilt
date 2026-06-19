import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import RecentPackagesTile from './RecentPackagesTile'

describe('website/pages/Landing/FrontDoor/Tiles/RecentPackagesTile', () => {
  afterEach(cleanup)

  it('renders the empty-state without error', () => {
    const { getByText } = render(<RecentPackagesTile />)
    expect(getByText('Recent packages')).toBeTruthy()
    expect(getByText('Open a package to see it here')).toBeTruthy()
  })
})
