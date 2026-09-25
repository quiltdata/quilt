import { describe, it, expect } from 'vitest'

import * as Column from './Column'

describe('components/Layout/Column', () => {
  it('retargets a query from the viewport to the main column', () => {
    expect(Column.down('sm')).toBe('@container main (max-width:959.95px)')
    expect(Column.up('md')).toBe('@container main (min-width:960px)')
  })

  it('passes a pixel width through at the same threshold MUI would emit', () => {
    // A named band would round these to 960/600 and move a hand-tuned tier.
    expect(Column.down(1044)).toBe('@container main (max-width:1043.95px)')
    expect(Column.down(844)).toBe('@container main (max-width:843.95px)')
  })

  // The page tiers retargeted onto the column (Bucket/Header, PackageTree)
  // carry pixel numbers derived from what the shell takes out of the viewport.
  // Read from the source, so a later edit to either number has to come here and
  // restate the rule rather than quietly drifting from the tier it replaced.
  describe('the retargeted page tiers', () => {
    const read = async (path: string) => {
      const fs = await import('fs')
      return fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    }

    // Above 960px the docked rail is the only chrome outside the measurement:
    // Qurator's gutter is padding on the column's parent, and the page inset is
    // inside the container. So a viewport tier of N is a column tier of N-256.
    const RAIL = 256

    it('bucket header stacks at the column the 1300px viewport tier meant', async () => {
      const src = await read('../../containers/Bucket/Header.tsx')
      expect(src).toContain(`Column.down(${1300 - RAIL})`)
      expect(src).not.toContain('breakpoints.down(1300)')
    })

    it('package top bar stacks at the column the 1100px viewport tier meant', async () => {
      const src = await read('../../containers/Bucket/PackageTree/PackageTree.tsx')
      expect(src).toContain(`Column.down(${1100 - RAIL})`)
      expect(src).not.toContain('breakpoints.down(1100)')
    })

    // Below 960px the rail is an overlay and takes no row width, so a tier in
    // that regime needs no translation -- the column *is* the viewport.
    it('the narrow readout tier keeps the viewport tier’s own number', async () => {
      const src = await read('../../containers/Bucket/Header.tsx')
      expect(src).toContain('Column.down(640)')
    })
  })
})
