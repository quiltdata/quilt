import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import HljsBoundary from './HljsBoundary'

describe('utils/HljsBoundary', () => {
  it('shows the fallback while a child suspends, then the child', async () => {
    let resolve!: () => void
    const gate = new Promise<void>((r) => {
      resolve = r
    })
    let thrown = false
    function Child() {
      if (!thrown) {
        thrown = true
        throw gate
      }
      return <span>ready</span>
    }
    render(
      <HljsBoundary fallback={<span>loading</span>}>
        <Child />
      </HljsBoundary>,
    )
    expect(screen.getByText('loading')).toBeTruthy()
    resolve()
    expect(await screen.findByText('ready')).toBeTruthy()
  })
})
